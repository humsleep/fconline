/** 오픈 리다이렉트 방지 — 앱 내부 경로만 허용(스킴·프로토콜상대 URL 차단). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  // 제어문자(0x00-0x1F)·백슬래시 제거(우회 방지) 후 검증
  // eslint-disable-next-line no-control-regex
  const cleaned = next.replace(/[\x00-\x1f\\]/g, '');
  // 반드시 '/'로 시작하고 '//'(프로토콜 상대)는 거부
  if (!cleaned.startsWith('/')) return '/';
  if (cleaned.startsWith('//')) return '/';
  // 인증 관련 경로로의 되돌림은 루프 방지를 위해 홈으로
  if (/^\/(login|auth)(\/|$|\?)/.test(cleaned)) return '/';
  return cleaned;
}
