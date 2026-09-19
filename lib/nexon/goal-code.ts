import type { ShootDetail } from './types';

/**
 * shootDetail.result 의 골 코드. 실측상 3 이 골이다(2026-09-20 데이터 감사: 보엠 23경기 중 22경기 일치).
 *
 * 예전에는 "개수가 전광판 골 수와 같은 코드"를 골로 골랐는데, 자책골이 있으면 전광판(goalTotalDisplay)과
 * 슛 기록의 골 수가 어긋나 진짜 골 코드(3)가 후보에서 빠지고, 우연히 개수가 같은 유효슛(1)을 골로 확정했다
 * → 득점 0인 선수의 슛이 골로 찍히고 시간대 득실·결정력이 오염됐다.
 * 이제 3 이 한 번이라도 나오면 3 으로 고정하고, 3 이 없을 때만(골이 없거나 스펙이 바뀐 경우) 옛 휴리스틱을 쓴다.
 */
export const GOAL_CODE = 3;

export function detectGoalCode(sides: { shots: ShootDetail[]; goals: number }[]): number | null {
  const values = new Set<number>();
  for (const s of sides) for (const shot of s.shots) values.add(shot.result);
  if (values.has(GOAL_CODE)) return GOAL_CODE;
  const totalGoals = sides.reduce((a, s) => a + s.goals, 0);
  if (totalGoals === 0) return GOAL_CODE; // 골이 없는 경기 — 어떤 슛도 골로 칠하지 않는다
  const candidates = [...values].filter(
    (v) => sides.reduce((a, s) => a + s.shots.filter((sh) => sh.result === v).length, 0) === totalGoals
  );
  return candidates.length === 1 ? candidates[0] : null;
}
