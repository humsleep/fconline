import type { MatchDetail } from './types';
import { baseLabelOfCode, posLineOf } from '../squad/assign';

const SUB_POSITION = 28;

/**
 * 경기들에서 선수×포지션 사용 빈도 상위 조합 — 랭커 스탯 예열 대상(크론·관리자 시딩 공용). 순수 함수.
 * 실제로 뛴(spRating > 0) 선발 포지션만 센다. 교체 대기(28)는 제외.
 */
export function popularCombos(details: (MatchDetail | null | undefined)[], limit: number): { id: number; po: number }[] {
  return popularCombosCounted(details, limit).map((p) => ({ id: p.id, po: p.po }));
}

/**
 * popularCombos 와 같되 사용 횟수(n)를 함께 준다 — 픽 랭킹의 정렬 기준.
 * 넥슨 ranker-stats 의 matchCount 는 조합마다 20 으로 같아(2026-09-19 실측) 인기 순위로 쓸 수 없다.
 */
export function popularCombosCounted(
  details: (MatchDetail | null | undefined)[],
  limit: number
): { id: number; po: number; n: number }[] {
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
  // 같은 카드의 ST(24/25/26)·CB(4/5/6)처럼 세부 코드만 다른 사용량을 합친다 — 코드별로 쪼개면 컷에서 떨어져
  // 공격 라인이 4명뿐이었다(2026-09-20 감사). 랭커 스탯은 가장 많이 쓴 세부 코드로 요청한다.
  const merged = new Map<string, { id: number; po: number; n: number; best: number }>();
  for (const f of freq.values()) {
    const key = `${f.id}:${baseLabelOfCode(f.po)}`;
    const cur = merged.get(key);
    if (!cur) merged.set(key, { id: f.id, po: f.po, n: f.n, best: f.n });
    else {
      cur.n += f.n;
      if (f.n > cur.best || (f.n === cur.best && f.po < cur.po)) { cur.po = f.po; cur.best = f.n; }
    }
  }
  const sorted = [...merged.values()]
    .map(({ id, po, n }) => ({ id, po, n }))
    .sort((a, b) => b.n - a.n || a.id - b.id || a.po - b.po);
  // 라인마다 고르게 뽑는다(전체 상위 N 만 뽑으면 미드필더가 자리를 다 차지했다).
  const perLine = Math.max(1, Math.ceil(limit / 4));
  const byLine = new Map<string, number>();
  const picked: { id: number; po: number; n: number }[] = [];
  const rest: { id: number; po: number; n: number }[] = [];
  for (const c of sorted) {
    const line = posLineOf(baseLabelOfCode(c.po));
    const k = byLine.get(line) ?? 0;
    if (k < perLine) { picked.push(c); byLine.set(line, k + 1); } else rest.push(c);
  }
  // 라인 몫을 못 채운 자리는 전체 사용량 순으로 채운다
  return [...picked, ...rest].slice(0, limit).sort((a, b) => b.n - a.n || a.id - b.id || a.po - b.po);
}
