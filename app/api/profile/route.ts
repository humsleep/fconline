import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateNickname } from '@/lib/community/constants';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ profile: null }, { status: 200 });

  const { data } = await supabase
    .from('profiles')
    .select('id, nickname, verified_nickname, verified_ouid, verified_at')
    .eq('id', user.id)
    .maybeSingle();

  // 마이페이지용 — 내 최근 커뮤니티 글(숨김 제외)
  let posts: { id: string; type: string; title: string; created_at: string }[] = [];
  try {
    const { data: p } = await supabase
      .from('community_posts')
      .select('id, type, title, created_at')
      .eq('author_id', user.id)
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(5);
    posts = p ?? [];
  } catch {
    // 테이블 미존재 등 — 빈 목록
  }

  return NextResponse.json({ profile: data ?? null, posts });
}

/** 닉네임 등록/변경 (upsert). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let nickname = '';
  try {
    const body = await request.json();
    nickname = String(body?.nickname ?? '').trim();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const invalid = validateNickname(nickname);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, nickname }, { onConflict: 'id' });

  // 약관 동의 시각 서버 기록 (최초 1회만 — 이미 있으면 유지)
  if (!error) {
    await supabase
      .from('profiles')
      .update({ consented_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('consented_at', null);
  }

  if (error) {
    // 유니크 위반(닉네임 중복)
    if (error.code === '23505')
      return NextResponse.json(
        { error: '이미 사용 중인 닉네임입니다.' },
        { status: 409 }
      );
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, nickname });
}
