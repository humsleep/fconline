/**
 * 공식경기/감독모드 등급(division) → 인게임 등급 아이콘 URL.
 * 공식 메타(division.json)에는 아이콘이 없어 넥슨 정적 CDN의 알려진 경로를 사용.
 * (FO4 시절부터 유지되는 자산 — 실패 시 <DivisionIcon>이 자동으로 숨긴다)
 */
// ico_rank 인덱스: 최상위(슈퍼챔피언스)=0 부터 내림차순
const ICON_INDEX: Record<number, number> = {
  800: 0, // 슈퍼챔피언스
  900: 1, // 챔피언스
  1000: 2, // 슈퍼챌린지
  1100: 3, // 챌린지1
  1200: 4, // 챌린지2
  1300: 5, // 챌린지3
  2000: 6, // 월드클래스1
  2100: 7, // 월드클래스2
  2200: 8, // 월드클래스3
  2300: 9, // 프로1
  2400: 10, // 프로2
  2500: 11, // 프로3
  2600: 12, // 세미프로1
  2700: 13, // 세미프로2
  2800: 14, // 세미프로3
  2900: 15, // 유망주1
  3000: 16, // 유망주2
  3100: 17, // 유망주3
};

export function divisionIconUrl(division: number): string | null {
  const idx = ICON_INDEX[division];
  if (idx === undefined) return null;
  return `https://ssl.nexon.com/s2/game/fo4/obt/rank/large/update_2009/ico_rank${idx}.png`;
}
