import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/supabase/admin';
import { revokeAppleAuthorization } from '@/lib/auth/apple-revoke';

export const dynamic = 'force-dynamic';

/**
 * 계정 삭제(회원 탈퇴) — App Store 5.1.1(v) 요건: 계정을 만들 수 있으면 앱 안에서 지울 수도 있어야 한다.
 * auth.users 행을 지우면 profiles / community_posts / community_comments / reports / user_snapshots 는
 * FK cascade 로 함께 삭제되고, squads.user_id 는 null 로 풀려 익명 스쿼드로 남는다(개인정보 없음).
 *
 * Apple 로그인 사용자는 앱이 삭제 직전 재인증으로 받은 `appleAuthorizationCode` 를 본문으로 보낸다 →
 * Apple 토큰을 폐기한 뒤 삭제한다(lib/auth/apple-revoke.ts). 폐기가 실패하거나 키가 없어도 삭제는 진행한다.
 */
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = getAdmin();
  if (!admin)
    return NextResponse.json(
      { error: '지금은 계정 삭제를 처리할 수 없어요. 문의 이메일로 요청해 주세요.' },
      { status: 503 }
    );

  let appleCode: string | null = null;
  try {
    const body = (await req.json()) as { appleAuthorizationCode?: unknown };
    if (typeof body.appleAuthorizationCode === 'string' && body.appleAuthorizationCode.length <= 1000)
      appleCode = body.appleAuthorizationCode;
  } catch {
    // 본문 없음(구버전 앱·웹) — 폐기 없이 삭제
  }
  if (appleCode) await revokeAppleAuthorization(appleCode);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: '삭제에 실패했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
  // 세션 쿠키 정리 (이미 삭제된 사용자라 실패해도 무방)
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
