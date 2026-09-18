import type { MatchInfoEntry } from './types';

/**
 * 팀(경기) 평점 — 순수 함수.
 *
 * 넥슨 matchDetail.averageRating 은 "출전 선수 평균"이 아니라 **엔트리 18명 전원 합 / 18** 이다.
 * 벤치에 앉아 있던 선수(spRating 0)도 분모에 들어가서 값이 3.3~5.1 로 눌려 있고,
 * 교체를 많이 할수록 올라간다(교체 1명 ≈ +0.35). 인게임·선수 카드 평점(5~10 척도)과 다른 단위라
 * 6.5 기준으로 짠 스코어·진단·판정이 전부 "분발 필요/고전"으로 쏠렸다.
 * 라이브 실측(2026-09-18, 11명 닉네임 · 159개 팀-경기): Σ(spRating)/averageRating = 18.00 (중앙값·p90),
 * 출전 선수 수 중앙값 11.
 *
 * 그래서 경기 평점은 **실제로 뛴 선수(spRating > 0)의 평균**으로 계산한다.
 * player[] 가 없는(아주 오래된 캐시 등) 경우에만 averageRating × 18 / 11 로 근사한다.
 */

const ROSTER = 18;
const STARTERS = 11;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function teamRating(entry: Pick<MatchInfoEntry, 'player' | 'matchDetail'> | null | undefined): number {
  if (!entry) return 0;
  const rated = (entry.player ?? [])
    .map((p) => p.status?.spRating ?? 0)
    .filter((r) => r > 0);
  if (rated.length > 0) return round2(rated.reduce((a, b) => a + b, 0) / rated.length);
  return legacyToTeamRating(entry.matchDetail?.averageRating ?? 0);
}

/** averageRating(18명 분모) → 출전 11명 기준 근사. 0/비정상은 0. */
export function legacyToTeamRating(averageRating: number): number {
  if (!Number.isFinite(averageRating) || averageRating <= 0) return 0;
  return round2(Math.min(10, (averageRating * ROSTER) / STARTERS));
}

/**
 * 저장된 스냅샷(user_snapshots.avg_rating) 읽기 보정.
 * 2026-09-18 이전 스냅샷은 averageRating 척도(실측 3.3~5.1, 30경기 평균은 3.9~4.5)로 저장됐다.
 * 새 척도의 30경기 평균은 사실상 5.5 미만이 나오지 않으므로(경기 단위 최저 실측 5.41) 5.5 를 경계로 환산한다.
 * 섞인 채로 두면 폼 추세 그래프가 배포일에 +2.5 점프한다.
 */
export const LEGACY_SNAPSHOT_MAX = 5.5;
export function normalizeSnapshotRating(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v < LEGACY_SNAPSHOT_MAX ? legacyToTeamRating(v) : v;
}

/**
 * 경기 평점(teamRating) 실측 분포 — 스코어·진단·판정 임계값의 근거.
 * 2026-09-18 라이브 159개 팀-경기: min 5.41 · p10 6.17 · p25 6.44 · 중앙값 6.71 · p75 7.07 · p90 7.51 · max 8.02.
 */
export const TEAM_RATING_MEDIAN = 6.7;
