/**
 * 스쿼드 클리닉 — 룰베이스 진단 엔진 (로드맵 Phase 2, AI 호출 없음).
 * "선수 성적표"(나열)를 넘어 스쿼드를 라인별로 종합·처방한다:
 *   종합 점수 + 라인별 강약 + 약한 고리 + 강점 + 밸런스 경고.
 * 입력은 이미 집계된 PlayerAggregate[] + 랭커 벤치마크(RankerMap)라 추가 fetch 없음.
 */

import type { PlayerAggregate } from './nexon/player-stats';

export type Line = 'GK' | 'DEF' | 'MID' | 'ATT';

export const LINE_LABEL: Record<Line, string> = {
  GK: '골키퍼',
  DEF: '수비',
  MID: '미드필드',
  ATT: '공격',
};

/** spposition(0~27) → 라인. 28(SUB)은 집계 단계에서 이미 제외됨. */
export function lineOf(spPosition: number): Line {
  if (spPosition === 0) return 'GK';
  if (spPosition <= 8) return 'DEF'; // 1~8
  if (spPosition <= 19) return 'MID'; // 9~19
  return 'ATT'; // 20~27
}

const LINE_ORDER: Line[] = ['ATT', 'MID', 'DEF', 'GK'];

export type Band = 'top' | 'strong' | 'balanced' | 'building' | 'rebuild';

export const BAND_LABEL: Record<Band, string> = {
  top: '최상위 스쿼드',
  strong: '상위권 스쿼드',
  balanced: '안정권 스쿼드',
  building: '성장형 스쿼드',
  rebuild: '재정비 필요',
};

export interface ClinicPlayer {
  spId: number;
  position: number;
  line: Line;
  games: number;
  avgRating: number;
  goals: number;
  assists: number;
  rankerRating?: number;
  gap?: number; // avgRating - rankerRating (있을 때만)
}

export interface LineReport {
  line: Line;
  label: string;
  count: number;
  avgRating: number; // 출전수 가중
  gap?: number; // 랭커 대비 가중 평균 (랭커 있는 선수만)
  score: number; // 0~100
}

export interface ClinicIssue {
  kind: 'weak-link' | 'over-reliance' | 'thin-line' | 'low-ranker-coverage';
  severity: 'high' | 'mid' | 'low';
  text: string;
  spId?: number;
}

export interface SquadClinicResult {
  overall: number; // 0~100
  band: Band;
  squadRating: number; // 출전수 가중 실사용 평점
  avgGap?: number; // 랭커 대비 가중 평균 (있을 때만)
  lines: LineReport[];
  weakLinks: ClinicPlayer[];
  strengths: ClinicPlayer[];
  issues: ClinicIssue[];
  rankerCoverage: number; // 0~1 (랭커 벤치마크가 붙은 선수 비율)
  players: number;
  sampleGames: number;
}

/** 평점 → 0~100 (verdict.ratingToScore와 동일 앵커: 5.0→0, 8.5→100). */
function ratingToScore(rating: number): number {
  return Math.round(Math.min(100, Math.max(0, ((rating - 5.0) / 3.5) * 100)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function bandOf(overall: number): Band {
  if (overall >= 80) return 'top';
  if (overall >= 65) return 'strong';
  if (overall >= 50) return 'balanced';
  if (overall >= 35) return 'building';
  return 'rebuild';
}

/** 출전수 가중 평균 (games=0이면 0). */
function weightedAvg(items: { value: number; weight: number }[]): number {
  let sum = 0;
  let w = 0;
  for (const it of items) {
    sum += it.value * it.weight;
    w += it.weight;
  }
  return w > 0 ? sum / w : 0;
}

export interface RankerLookup {
  (spId: number, position: number): number | undefined;
}

/**
 * 스쿼드 진단. players는 주전 표본(예: 2경기 이상 출전)만 넘긴다.
 * rankerRating은 (spId, mainPosition)로 랭커 평점을 돌려주는 조회 함수.
 */
export function diagnoseSquad(
  players: PlayerAggregate[],
  rankerRating: RankerLookup
): SquadClinicResult | null {
  if (players.length === 0) return null;

  const cps: ClinicPlayer[] = players.map((p) => {
    const rr = rankerRating(p.spId, p.mainPosition);
    const hasRanker = typeof rr === 'number' && rr > 0;
    return {
      spId: p.spId,
      position: p.mainPosition,
      line: lineOf(p.mainPosition),
      games: p.games,
      avgRating: p.avgRating,
      goals: p.goals,
      assists: p.assists,
      rankerRating: hasRanker ? rr : undefined,
      gap: hasRanker ? round2(p.avgRating - rr!) : undefined,
    };
  });

  const totalGames = cps.reduce((s, p) => s + p.games, 0);
  const squadRating = round2(
    weightedAvg(cps.map((p) => ({ value: p.avgRating, weight: p.games })))
  );

  // 랭커 대비 가중 평균 (랭커 있는 선수만)
  const withRanker = cps.filter((p) => p.gap !== undefined);
  const avgGap =
    withRanker.length > 0
      ? round2(
          weightedAvg(
            withRanker.map((p) => ({ value: p.gap!, weight: p.games }))
          )
        )
      : undefined;
  const rankerCoverage = round2(withRanker.length / cps.length);

  // 종합 점수: 실사용 평점 기반 + 랭커 대비 보정(±).
  // 보정은 랭커 커버리지로 감쇠 — 소수 벤치마크가 점수를 과하게 흔드는 것을 방지.
  let overall = ratingToScore(squadRating);
  if (avgGap !== undefined) {
    overall = Math.min(
      100,
      Math.max(0, Math.round(overall + avgGap * 12 * rankerCoverage))
    );
  }
  const band = bandOf(overall);

  // 라인별 리포트
  const lines: LineReport[] = [];
  for (const line of LINE_ORDER) {
    const inLine = cps.filter((p) => p.line === line);
    if (inLine.length === 0) continue;
    const lr = round2(
      weightedAvg(inLine.map((p) => ({ value: p.avgRating, weight: p.games })))
    );
    const lineRankers = inLine.filter((p) => p.gap !== undefined);
    const lgap =
      lineRankers.length > 0
        ? round2(
            weightedAvg(
              lineRankers.map((p) => ({ value: p.gap!, weight: p.games }))
            )
          )
        : undefined;
    lines.push({
      line,
      label: LINE_LABEL[line],
      count: inLine.length,
      avgRating: lr,
      gap: lgap,
      score: ratingToScore(lr),
    });
  }

  // 약한 고리: 랭커 대비 뒤처지는 선수 우선(gap 오름차순), 부족하면 평점 낮은 주전 보충.
  const belowRanker = withRanker
    .filter((p) => p.gap! < 0)
    .sort((a, b) => a.gap! - b.gap!);
  const weakSet = new Set<number>();
  const weakLinks: ClinicPlayer[] = [];
  for (const p of belowRanker) {
    if (weakLinks.length >= 3) break;
    weakLinks.push(p);
    weakSet.add(p.spId);
  }
  if (weakLinks.length < 3) {
    const lowRated = cps
      .filter((p) => !weakSet.has(p.spId) && p.avgRating < squadRating)
      .sort((a, b) => a.avgRating - b.avgRating);
    for (const p of lowRated) {
      if (weakLinks.length >= 3) break;
      weakLinks.push(p);
      weakSet.add(p.spId);
    }
  }
  const weakTop = weakLinks;

  // 강점: 랭커 상회(gap 내림차순) 우선, 부족하면 스쿼드 평균 이상 선수만 보충.
  // 약한 고리로 이미 뽑힌 선수는 제외 → 동일 선수가 강점·약점에 동시 노출되지 않음.
  const aboveRanker = withRanker
    .filter((p) => p.gap! > 0 && !weakSet.has(p.spId))
    .sort((a, b) => b.gap! - a.gap!);
  const strongSet = new Set<number>();
  const strengths: ClinicPlayer[] = [];
  for (const p of aboveRanker) {
    if (strengths.length >= 3) break;
    strengths.push(p);
    strongSet.add(p.spId);
  }
  if (strengths.length < 3) {
    // 하한: 스쿼드 평균 이상만 강점 후보 — 부진한 스쿼드에서 약한 선수를 강점으로 오진 방지.
    const highRated = cps
      .filter(
        (p) =>
          !strongSet.has(p.spId) &&
          !weakSet.has(p.spId) &&
          p.avgRating >= squadRating
      )
      .sort((a, b) => b.avgRating - a.avgRating);
    for (const p of highRated) {
      if (strengths.length >= 3) break;
      strengths.push(p);
      strongSet.add(p.spId);
    }
  }
  const strengthTop = strengths;

  // 이슈 진단
  const issues: ClinicIssue[] = [];

  // 1) 약한 고리 (표시된 weakTop 중 랭커 대비 크게 밑도는 선수 — 섹션과 개수 정합)
  for (const p of weakTop) {
    if (typeof p.gap === 'number' && p.gap <= -0.3) {
      issues.push({
        kind: 'weak-link',
        severity: p.gap <= -0.7 ? 'high' : 'mid',
        spId: p.spId,
        text: `랭커 대비 평점 ${Math.abs(p.gap).toFixed(2)} 낮음 — 교체 1순위 후보`,
      });
    }
  }

  // 2) 득점 과의존 (한 선수가 스쿼드 총득점의 절반 이상)
  const totalGoals = cps.reduce((s, p) => s + p.goals, 0);
  if (totalGoals >= 8) {
    const topScorer = [...cps].sort((a, b) => b.goals - a.goals)[0];
    const share = topScorer.goals / totalGoals;
    if (share >= 0.45) {
      issues.push({
        kind: 'over-reliance',
        severity: share >= 0.6 ? 'high' : 'mid',
        spId: topScorer.spId,
        text: `득점의 ${Math.round(share * 100)}%를 한 선수가 책임 — 득점 루트 분산 필요`,
      });
    }
  }

  // 3) 라인 표본 공백 (공격/미드/수비 주전 표본 없음 — 포메이션·표본 영향)
  for (const line of ['ATT', 'MID', 'DEF'] as Line[]) {
    if (!lines.some((l) => l.line === line)) {
      issues.push({
        kind: 'thin-line',
        severity: 'low',
        text: `${LINE_LABEL[line]} 라인 표본 부족 — 최근 경기에 고정 주전이 적음`,
      });
    }
  }

  // 4) 랭커 커버리지 낮음 (비교 신뢰도 경고)
  if (rankerCoverage < 0.3) {
    issues.push({
      kind: 'low-ranker-coverage',
      severity: 'low',
      text: '랭커 비교 데이터가 적어 절대 평점 기준으로 진단했습니다.',
    });
  }

  // 심각도 → 표시 우선순위
  const sev = { high: 0, mid: 1, low: 2 } as const;
  issues.sort((a, b) => sev[a.severity] - sev[b.severity]);

  return {
    overall,
    band,
    squadRating,
    avgGap,
    lines,
    weakLinks: weakTop,
    strengths: strengthTop,
    issues,
    rankerCoverage,
    players: cps.length,
    sampleGames: totalGames,
  };
}
