/** 배포 도메인 — 커스텀 도메인 전환 시 NEXT_PUBLIC_SITE_URL 하나만 바꾸면 됨. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fconline-beryl.vercel.app'
).replace(/\/$/, '');

/** 표시용 호스트명 (프로토콜 제거) — 공유 카드 푸터 등 */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
