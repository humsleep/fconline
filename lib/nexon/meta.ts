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

/** 전적 페이지에서 탭으로 노출하는 매치 종류 */
export const MATCH_TABS = [
  { type: 50, label: '공식경기' },
  { type: 52, label: '감독모드' },
  { type: 40, label: '클래식 1on1' },
] as const;
