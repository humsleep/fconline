import 'server-only';

const META_BASE = 'https://open.api.nexon.com/static/fconline/meta';

/** 메타데이터 fetch (인증 불필요). 실패 시 null → 정적 폴백 사용. */
async function fetchMeta<T>(name: string): Promise<T | null> {
  try {
    const res = await fetch(`${META_BASE}/${name}.json`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// 메타 API 장애 시에도 서비스가 죽지 않도록 알려진 값은 정적으로 유지
const DIVISION_FALLBACK: Record<number, string> = {
  800: '슈퍼챔피언스',
  900: '챔피언스',
  1000: '슈퍼챌린지',
  1100: '챌린지1',
  1200: '챌린지2',
  1300: '챌린지3',
  2000: '월드클래스1',
  2100: '월드클래스2',
  2200: '월드클래스3',
  2300: '프로1',
  2400: '프로2',
  2500: '프로3',
  2600: '세미프로1',
  2700: '세미프로2',
  2800: '세미프로3',
  2900: '유망주1',
  3000: '유망주2',
  3100: '유망주3',
};

const MATCHTYPE_FALLBACK: Record<number, string> = {
  30: '리그 친선경기',
  40: '클래식 1on1',
  50: '공식경기',
  52: '감독모드',
  60: '공식 친선경기',
  204: '볼타 친선경기',
  214: '볼타 공식경기',
  224: '볼타 AI경기',
};

export async function getDivisionName(division: number): Promise<string> {
  const meta = await fetchMeta<{ divisionId: number; divisionName: string }[]>(
    'division'
  );
  const found = meta?.find((d) => d.divisionId === division)?.divisionName;
  return found ?? DIVISION_FALLBACK[division] ?? `등급 ${division}`;
}

export async function getMatchTypeName(matchType: number): Promise<string> {
  const meta = await fetchMeta<{ matchtype: number; desc: string }[]>(
    'matchtype'
  );
  const found = meta?.find((m) => m.matchtype === matchType)?.desc;
  return found ?? MATCHTYPE_FALLBACK[matchType] ?? `매치 ${matchType}`;
}

/**
 * 등급(division) → 티어 색. division 숫자가 작을수록 상위(800 슈퍼챔피언스 … 3100 유망주3).
 * 챌린지 이상(≤1300)=gold, 월드클래스(≤2200)=lime, 프로 이하=muted. (순수 — API 미사용)
 */
export function divisionTierColor(division: number): 'gold' | 'lime' | 'muted' {
  if (division > 0 && division <= 1300) return 'gold';
  if (division <= 2200) return 'lime';
  return 'muted';
}

/** 전적 페이지에서 탭으로 노출하는 매치 종류 */
export const MATCH_TABS = [
  { type: 50, label: '공식경기' },
  { type: 52, label: '감독모드' },
  { type: 40, label: '클래식 1on1' },
] as const;

/** spposition 코드 → 포지션 약어 (FC온라인 표준 0~28) */
const POSITION_LABELS: Record<number, string> = {
  0: 'GK',
  1: 'SW',
  2: 'RWB',
  3: 'RB',
  4: 'RCB',
  5: 'CB',
  6: 'LCB',
  7: 'LB',
  8: 'LWB',
  9: 'RDM',
  10: 'CDM',
  11: 'LDM',
  12: 'RM',
  13: 'RCM',
  14: 'CM',
  15: 'LCM',
  16: 'LM',
  17: 'RAM',
  18: 'CAM',
  19: 'LAM',
  20: 'RF',
  21: 'CF',
  22: 'LF',
  23: 'RW',
  24: 'RS',
  25: 'ST',
  26: 'LS',
  27: 'LW',
  28: 'SUB',
};

export function getPositionLabel(spPosition: number): string {
  return POSITION_LABELS[spPosition] ?? `P${spPosition}`;
}
