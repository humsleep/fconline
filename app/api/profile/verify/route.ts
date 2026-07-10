import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOuid } from '@/lib/nexon/api';
import {
  isUserNotFound,
  isNotConfigured,
  isMaintenance,
} from '@/lib/nexon/client';

/** FC Online 구단주명 연동 — 닉네임을 ouid로 해석해 프로필에 저장(존재 검증 수준). */
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
  if (!nickname)
    return NextResponse.json(
      { error: 'FC Online 구단주명을 입력하세요.' },
      { status: 400 }
    );

  // 프로필(닉네임)이 있어야 연동 가능 — Nexon 호출 전에 먼저 확인
  const { data: me } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!me)
    return NextResponse.json(
      { error: '먼저 커뮤니티 닉네임을 등록하세요.' },
      { status: 409 }
    );

  let ouid: string;
  try {
    ouid = await getOuid(nickname);
  } catch (err) {
    if (isUserNotFound(err))
      return NextResponse.json(
        { error: '해당 구단주명을 찾을 수 없습니다.' },
        { status: 404 }
      );
    if (isNotConfigured(err))
      return NextResponse.json(
        { error: '넥슨 API 연동 설정이 완료되지 않았습니다.' },
        { status: 503 }
      );
    if (isMaintenance(err))
      return NextResponse.json(
        { error: '넥슨 API 점검 중입니다. 잠시 후 다시 시도하세요.' },
        { status: 503 }
      );
    return NextResponse.json({ error: '연동에 실패했습니다.' }, { status: 502 });
  }

  // 다른 계정이 이미 이 구단주명을 연동했는지 확인(중복 사칭 방지)
  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('verified_ouid', ouid)
    .neq('id', user.id)
    .maybeSingle();
  if (taken)
    return NextResponse.json(
      { error: '이미 다른 계정에 연동된 구단주명입니다.' },
      { status: 409 }
    );

  const { error } = await supabase
    .from('profiles')
    .update({
      verified_nickname: nickname,
      verified_ouid: ouid,
      verified_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    // DB 유니크 위반 — 동시 요청 경쟁에서 다른 계정이 먼저 연동한 경우
    if (error.code === '23505')
      return NextResponse.json(
        { error: '이미 다른 계정에 연동된 구단주명입니다.' },
        { status: 409 }
      );
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, verified_nickname: nickname, ouid });
}
