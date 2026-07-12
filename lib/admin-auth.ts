import 'server-only';

/**
 * 운영자 판별 — ADMIN_EMAILS(쉼표 구분) 환경변수와 로그인 이메일 대조.
 * 미설정 시 아무도 관리자가 아님(fail-closed).
 */
export function isAdminEmail(email?: string | null): boolean {
  const raw = process.env.ADMIN_EMAILS ?? '';
  if (!raw || !email) return false;
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
