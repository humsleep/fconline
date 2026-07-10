/** 커뮤니티 공통 상수 — 지역(시/도) + 모집 포지션 프리셋. */

export const REGIONS = [
  '전국(온라인)',
  '서울',
  '경기',
  '인천',
  '강원',
  '대전',
  '세종',
  '충북',
  '충남',
  '대구',
  '경북',
  '부산',
  '울산',
  '경남',
  '광주',
  '전북',
  '전남',
  '제주',
] as const;

export type Region = (typeof REGIONS)[number];

/** 모집 포지션 픽 리스트 — FC온라인 라인 기준 대표 포지션. */
export const POSITION_OPTIONS = [
  'ST',
  'CF',
  'LW',
  'RW',
  'CAM',
  'CM',
  'CDM',
  'LM',
  'RM',
  'LB',
  'RB',
  'CB',
  'GK',
] as const;

export type PositionOption = (typeof POSITION_OPTIONS)[number];

export const NICKNAME_MAX = 16;
export const NICKNAME_MIN = 2;
export const TITLE_MAX = 60;
export const BODY_MAX = 2000;

/** 닉네임 유효성 — 공백/특수기호 최소 제한, 길이 검증. */
export function validateNickname(raw: string): string | null {
  const n = raw.trim();
  if (n.length < NICKNAME_MIN) return `닉네임은 최소 ${NICKNAME_MIN}자입니다.`;
  if (n.length > NICKNAME_MAX) return `닉네임은 최대 ${NICKNAME_MAX}자입니다.`;
  if (!/^[가-힣a-zA-Z0-9 _.-]+$/.test(n))
    return '닉네임에 사용할 수 없는 문자가 있습니다.';
  return null;
}
