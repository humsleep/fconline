import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { shortId } from '@/lib/community/posts';
import {
  POST_TYPES,
  isPostType,
  TITLE_MAX,
  BODY_MAX,
  META_MAX,
  type PostField,
} from '@/lib/community/post-types';
import { REGIONS, POSITION_OPTIONS } from '@/lib/community/constants';
import { MODERATION_MESSAGE, containsBannedWords } from '@/lib/community/moderation';
import { parseAttachInput } from '@/lib/community/attach';

const REGION_SET = new Set<string>(REGIONS);
const POSITION_SET = new Set<string>(POSITION_OPTIONS);
const META_KEYS: PostField[] = ['budget', 'schedule', 'date', 'format', 'entry'];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.nickname)
    return NextResponse.json(
      { error: '먼저 커뮤니티 닉네임을 등록하세요.' },
      { status: 403 }
    );

  // 작성 간격 제한 사전 체크(30초) — RLS(0013)와 이중 방어. 명확한 메시지를 주기 위함.
  const { data: recent } = await supabase
    .from('community_posts')
    .select('created_at')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < 30_000)
    return NextResponse.json(
      { error: '조금 천천히요! 글은 30초에 한 번 작성할 수 있어요.' },
      { status: 429 }
    );

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const type = String(payload.type ?? '');
  if (!isPostType(type))
    return NextResponse.json({ error: '알 수 없는 게시글 유형입니다.' }, { status: 400 });
  const cfg = POST_TYPES[type];
  const allowed = new Set<PostField>(cfg.fields);

  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  if (!title || !body)
    return NextResponse.json({ error: '제목과 내용을 입력하세요.' }, { status: 400 });
  if (title.length > TITLE_MAX || body.length > BODY_MAX)
    return NextResponse.json({ error: '입력이 너무 깁니다.' }, { status: 400 });

  // 유형이 허용하는 필드만 반영
  const region =
    allowed.has('region') && payload.region && REGION_SET.has(String(payload.region))
      ? String(payload.region)
      : null;

  const positions =
    allowed.has('positions') && Array.isArray(payload.positions)
      ? [...new Set(payload.positions.map(String))]
          .filter((p) => POSITION_SET.has(p))
          .slice(0, 6)
      : [];

  const contact =
    allowed.has('contact') && payload.contact
      ? String(payload.contact).trim().slice(0, META_MAX) || null
      : null;

  // 공유코드는 영숫자만(빌더가 생성하는 형식) — 링크 경로 오염 방지
  const rawSquad =
    allowed.has('squad') && payload.squad_id
      ? String(payload.squad_id).trim().slice(0, 32)
      : '';
  const squad_id = /^[a-zA-Z0-9]{1,32}$/.test(rawSquad) ? rawSquad : null;

  const meta: Record<string, string> = {};
  for (const k of META_KEYS) {
    if (allowed.has(k) && payload[k]) {
      const v = String(payload[k]).trim().slice(0, META_MAX);
      if (v) meta[k] = v;
    }
  }

  // 첨부(내 전적 카드 · VS 카드) — meta 에 평평한 문자열 키로(구버전 앱 호환, lib/community/attach.ts)
  // 첨부를 보냈는데 형식이 틀리면 글을 저장하지 않고 이유를 돌려준다 — 조용히 첨부만 빠진 채 올라가면 작성자가 모른다.
  // (구버전 앱은 attach 를 보내지 않으므로 영향 없음)
  const hasAttach = payload.attach !== undefined && payload.attach !== null;
  const attach = hasAttach ? parseAttachInput(payload.attach) : null;
  if (hasAttach && !attach)
    return NextResponse.json(
      { error: '첨부한 구단주명을 확인해 주세요. (공백·특수문자 없이 20자 이하, VS 는 서로 다른 두 구단주)' },
      { status: 400 }
    );
  if (attach) Object.assign(meta, attach);

  // UGC 금칙어(App Store 1.2) — 사용자가 쓴 모든 자유 텍스트(첨부 구단주명 포함)
  if (containsBannedWords(title, body, contact, ...Object.values(meta)))
    return NextResponse.json({ error: MODERATION_MESSAGE }, { status: 400 });

  // 스쿼드 배틀 B팀 — meta.squad_b(공유코드 형식만)
  if (allowed.has('squad_b') && payload.squad_b) {
    const b = String(payload.squad_b).trim().slice(0, 32);
    if (/^[a-zA-Z0-9]{1,32}$/.test(b)) meta.squad_b = b;
  }

  // 스쿼드 배틀은 A·B 둘 다 필요
  if (type === 'squad_battle' && (!squad_id || !meta.squad_b)) {
    return NextResponse.json(
      { error: '스쿼드 배틀은 A·B 두 스쿼드가 필요합니다.' },
      { status: 400 }
    );
  }

  const id = shortId();
  const { error } = await supabase.from('community_posts').insert({
    id,
    author_id: user.id,
    type,
    title,
    body,
    region,
    positions,
    contact,
    squad_id,
    meta,
    status: 'open',
  });

  if (error) {
    if (error.code === '42501')
      return NextResponse.json(
        { error: '작성이 거부됐어요. 닉네임 등록 또는 작성 간격(30초)을 확인하세요.' },
        { status: 403 }
      );
    if (error.code === '42P01')
      return NextResponse.json(
        { error: '게시판 테이블이 없습니다. 마이그레이션(0006)을 실행하세요.' },
        { status: 500 }
      );
    return NextResponse.json({ error: '등록에 실패했습니다.' }, { status: 500 });
  }
  // attach: 첨부를 저장했으면 "saved" — 앱이 첨부 지원 서버인지 확인한다(필드 추가만)
  return NextResponse.json({ ok: true, id, ...(attach ? { attach: 'saved' } : {}) });
}
