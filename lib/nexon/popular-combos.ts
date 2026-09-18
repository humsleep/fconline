import type { MatchDetail } from './types';

const SUB_POSITION = 28;

/**
 * 경기들에서 선수×포지션 사용 빈도 상위 조합 — 랭커 스탯 예열 대상(크론·관리자 시딩 공용). 순수 함수.
 * 실제로 뛴(spRating > 0) 선발 포지션만 센다. 교체 대기(28)는 제외.
 */
export function popularCombos(details: (MatchDetail | null | undefined)[], limit: number): { id: number; po: number }[] {
  const freq = new Map<string, { id: number; po: number; n: number }>();
  for (const d of details) {
    for (const e of d?.matchInfo ?? []) {
      for (const p of e.player ?? []) {
        if ((p.status?.spRating ?? 0) <= 0 || p.spPosition === SUB_POSITION) continue;
        const key = `${p.spId}:${p.spPosition}`;
        const cur = freq.get(key);
        if (cur) cur.n += 1;
        else freq.set(key, { id: p.spId, po: p.spPosition, n: 1 });
      }
    }
  }
  return [...freq.values()]
    .sort((a, b) => b.n - a.n || a.id - b.id || a.po - b.po)
    .slice(0, limit)
    .map((p) => ({ id: p.id, po: p.po }));
}
