/** 배포 도메인 — 커스텀 도메인 전환 시 NEXT_PUBLIC_SITE_URL 하나만 바꾸면 됨.
 *  기본값은 운영 도메인(www.fcscope.xyz). Vercel primary 도메인과 일치. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.fcscope.xyz'
).replace(/\/$/, '');

/** 표시용 호스트명 (프로토콜 제거) — 공유 카드 푸터 등 */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
