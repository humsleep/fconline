/**
 * 공식경기/감독모드 등급(division) → 인게임 등급 아이콘 URL.
 * 공식 메타(division.json)에는 아이콘이 없어 넥슨 정적 CDN의 알려진 경로를 사용.
 * (FO4 시절부터 유지되는 자산 — 실패 시 <DivisionIcon>이 자동으로 숨긴다)
 */
// ico_rank 인덱스는 최하위(유망주3)=0 부터 오름차순 — 최상위(슈퍼챔피언스)=17
const ICON_INDEX: Record<number, number> = {
  800: 17, // 슈퍼챔피언스
  900: 16, // 챔피언스
  1000: 15, // 슈퍼챌린지
  1100: 14, // 챌린지1
  1200: 13, // 챌린지2
  1300: 12, // 챌린지3
  2000: 11, // 월드클래스1
  2100: 10, // 월드클래스2
  2200: 9, // 월드클래스3
  2300: 8, // 프로1
  2400: 7, // 프로2
  2500: 6, // 프로3
  2600: 5, // 세미프로1
  2700: 4, // 세미프로2
  2800: 3, // 세미프로3
  2900: 2, // 유망주1
  3000: 1, // 유망주2
  3100: 0, // 유망주3
};

export function divisionIconUrl(division: number): string | null {
  const idx = ICON_INDEX[division];
  if (idx === undefined) return null;
  return `https://ssl.nexon.com/s2/game/fo4/obt/rank/large/update_2009/ico_rank${idx}.png`;
}
