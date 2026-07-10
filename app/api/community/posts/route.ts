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
        { error: '작성 권한이 없습니다. 닉네임 등록을 확인하세요.' },
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
