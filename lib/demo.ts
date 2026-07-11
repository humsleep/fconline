/**
 * 데모 구단주 — 검색할 닉네임이 없는 첫 방문자에게 예시 리포트를 보여준다.
 * 운영: Vercel 환경변수 NEXT_PUBLIC_DEMO_NICKNAME 에 실존 활동 계정(운영자 계정 권장)을
 * 넣으면 홈·에러 화면에 "예시로 구경하기" 버튼이 나타난다. 미설정 시 자동 숨김.
 */
export const DEMO_NICKNAME = (
  process.env.NEXT_PUBLIC_DEMO_NICKNAME ?? ""
).trim();
