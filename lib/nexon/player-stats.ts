import type { MatchDetail, MatchPlayer } from './types';

export interface PlayerAggregate {
  spId: number;
  /** 가장 자주 출전한 포지션 코드 */
  mainPosition: number;
  /** 출전 경기 수 (spRating > 0 기준) */
  games: number;
  avgRating: number;
  goals: number;
  assists: number;
  goalsPerGame: number;
  assistsPerGame: number;
  shoot: number;
  effectiveShoot: number;
  passTry: number;
  passSuccess: number;
  passRate: number; // 0~100
  dribbleTry: number;
  dribbleSuccess: number;
  tackleTry: number;
  tackle: number;
  intercept: number;
}

interface Acc {
  spId: number;
  positions: Map<number, number>;
  games: number;
  ratingSum: number;
  goals: number;
  assists: number;
  shoot: number;
  effectiveShoot: number;
  passTry: number;
  passSuccess: number;
  dribbleTry: number;
  dribbleSuccess: number;
  tackleTry: number;
  tackle: number;
  intercept: number;
}

/** SUB 포지션(28)은 교체 명단 — 출전 집계에서 제외 판단에 사용 */
const SUB_POSITION = 28;

function isPlayed(p: MatchPlayer): boolean {
  // 실제 출전 = 평점이 잡힌 경우. 벤치(SUB, rating 0)는 제외.
  return (p.status?.spRating ?? 0) > 0 && p.spPosition !== SUB_POSITION;
}

/**
 * 유저(ouid)의 여러 매치에서 출전 선수 스탯을 누적 집계.
 * 각 선수의 주 포지션·평균 평점·경기당 골 등을 반환(경기 수 내림차순).
 */
export function aggregatePlayers(
  matches: MatchDetail[],
  ouid: string
): PlayerAggregate[] {
  const map = new Map<number, Acc>();

  for (const match of matches) {
    const entry = match.matchInfo?.find((e) => e.ouid === ouid);
    if (!entry) continue;

    for (const p of entry.player ?? []) {
      if (!isPlayed(p)) continue;
      const s = p.status;

      let acc = map.get(p.spId);
      if (!acc) {
        acc = {
          spId: p.spId,
          positions: new Map(),
          games: 0,
          ratingSum: 0,
          goals: 0,
          assists: 0,
          shoot: 0,
          effectiveShoot: 0,
          passTry: 0,
          passSuccess: 0,
          dribbleTry: 0,
          dribbleSuccess: 0,
          tackleTry: 0,
          tackle: 0,
          intercept: 0,
        };
        map.set(p.spId, acc);
      }

      acc.games += 1;
      acc.ratingSum += s.spRating ?? 0;
      acc.goals += s.goal ?? 0;
      acc.assists += s.assist ?? 0;
      acc.shoot += s.shoot ?? 0;
      acc.effectiveShoot += s.effectiveShoot ?? 0;
      acc.passTry += s.passTry ?? 0;
      acc.passSuccess += s.passSuccess ?? 0;
      acc.dribbleTry += s.dribbleTry ?? 0;
      acc.dribbleSuccess += s.dribbleSuccess ?? 0;
      acc.tackleTry += s.tackleTry ?? 0;
      acc.tackle += s.tackle ?? 0;
      acc.intercept += s.intercept ?? 0;
      acc.positions.set(
        p.spPosition,
        (acc.positions.get(p.spPosition) ?? 0) + 1
      );
    }
  }

  const result: PlayerAggregate[] = [];
  for (const acc of map.values()) {
    if (acc.games === 0) continue;
    result.push({
      spId: acc.spId,
      mainPosition: dominantPosition(acc.positions),
      games: acc.games,
      avgRating: round2(acc.ratingSum / acc.games),
      goals: acc.goals,
      assists: acc.assists,
      goalsPerGame: round2(acc.goals / acc.games),
      assistsPerGame: round2(acc.assists / acc.games),
      shoot: acc.shoot,
      effectiveShoot: acc.effectiveShoot,
      passTry: acc.passTry,
      passSuccess: acc.passSuccess,
      passRate: acc.passTry ? Math.round((acc.passSuccess / acc.passTry) * 100) : 0,
      dribbleTry: acc.dribbleTry,
      dribbleSuccess: acc.dribbleSuccess,
      tackleTry: acc.tackleTry,
      tackle: acc.tackle,
      intercept: acc.intercept,
    });
  }

  // 경기 수 → 평점 순 정렬 (표본 많고 잘한 선수 우선)
  result.sort((a, b) => b.games - a.games || b.avgRating - a.avgRating);
  return result;
}

/** 최다 출전 포지션. 동점이면 포지션 코드가 낮은 쪽(더 수비적)으로 결정적 선택. */
function dominantPosition(positions: Map<number, number>): number {
  let best = -1;
  let bestCount = -1;
  for (const [pos, count] of positions) {
    if (count > bestCount || (count === bestCount && pos < best)) {
      best = pos;
      bestCount = count;
    }
  }
  return best;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
