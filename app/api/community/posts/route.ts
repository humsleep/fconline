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
  return NextResponse.json({ ok: true, id });
}
