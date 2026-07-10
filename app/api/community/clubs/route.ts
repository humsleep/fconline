import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { shortId } from '@/lib/community/clubs';
import {
  REGIONS,
  POSITION_OPTIONS,
  TITLE_MAX,
  BODY_MAX,
} from '@/lib/community/constants';

const REGION_SET = new Set<string>(REGIONS);
const POSITION_SET = new Set<string>(POSITION_OPTIONS);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // 닉네임 등록 여부 확인(RLS와 이중 방어 + 친절한 메시지)
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

  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  if (!title || !body)
    return NextResponse.json(
      { error: '제목과 내용을 입력하세요.' },
      { status: 400 }
    );
  if (title.length > TITLE_MAX || body.length > BODY_MAX)
    return NextResponse.json({ error: '입력이 너무 깁니다.' }, { status: 400 });

  const rawRegion = payload.region ? String(payload.region) : null;
  const region = rawRegion && REGION_SET.has(rawRegion) ? rawRegion : null;

  const positions = Array.isArray(payload.positions)
    ? [...new Set(payload.positions.map(String))]
        .filter((p) => POSITION_SET.has(p))
        .slice(0, 6)
    : [];

  const playStyle = payload.play_style
    ? String(payload.play_style).trim().slice(0, 60) || null
    : null;
  const contact = payload.contact
    ? String(payload.contact).trim().slice(0, 120) || null
    : null;

  const id = shortId();
  const { error } = await supabase.from('club_posts').insert({
    id,
    author_id: user.id,
    title,
    body,
    region,
    positions,
    play_style: playStyle,
    contact,
    status: 'open',
  });

  if (error) {
    if (error.code === '42501')
      return NextResponse.json(
        { error: '작성 권한이 없습니다. 닉네임 등록을 확인하세요.' },
        { status: 403 }
      );
    return NextResponse.json({ error: '등록에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
