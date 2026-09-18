import type { MatchSummary } from './summary';
import { TEAM_RATING_MEDIAN } from './rating';

/**
 * FC Scope 스코어 — 경기 퍼포먼스 0~10 (op.gg OP Score / fut.gg GGR 대응).
 * 넥슨이 주는 경기 데이터만으로 산출(유료 데이터 불필요): 승패·득실차·인게임 평점·점유율.
 * 순수 함수 — 결정적, 단위 테스트 가능.
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** 단일 경기 스코어(0~10). */
export function matchScore(m: MatchSummary): number {
  // 몰수 경기는 정상 경기가 아니라 왜곡 방지로 고정값
  if (m.forfeit) {
    return m.result === '승' ? 6 : m.result === '패' ? 3 : 5;
  }
  // 결과가 기본 축 (승/무/패)
  let s = m.result === '승' ? 6.5 : m.result === '패' ? 3.8 : 5.0;
  // 득실차 — 대승/대패 반영 (±4골까지)
  const diff = m.me.goals - (m.opponent?.goals ?? 0);
  s += clamp(diff, -4, 4) * 0.35;
  // 경기 평점(출전 선수 평균, teamRating) — 실측 중앙값 6.7 기준 가감, 데이터 있을 때만.
  // 실측 IQR 6.44~7.07(폭 0.63)이라 계수 0.8 → 사분위에서 ±0.25, 극단(±1.5)에서 ±1.2.
  // (예전엔 18명 분모 averageRating(3.3~5.1)을 6.5 기준으로 빼서 거의 모든 경기가 −1 점 깎였다.)
  if (m.me.rating > 0) s += clamp(m.me.rating - TEAM_RATING_MEDIAN, -1.5, 1.5) * 0.8;
  // 점유율 소폭
  s += clamp((m.me.possession - 50) / 50, -1, 1) * 0.4;
  return round1(clamp(s, 0, 10));
}

/**
 * 최근 폼 스코어(0~10) — scoreTier 와 같은 눈금에 올리기 위해 평균을 중심에서 펼친다.
 *
 * 단일 경기 스코어는 승 ≈ 7, 패 ≈ 3.5 로 갈리는데, 이를 평균하면 승률과 무관하게 5 근처로 뭉친다
 * (라이브 11명 실측 평균 4.5~5.6, 합성 승률 50%→5.6 · 60%→5.9 · 80%→6.6 · 90%→6.9).
 * scoreTier 컷(5 / 6.5 / 8)은 단일 경기 눈금이라(앱도 경기별 스코어를 6.5/5 로 색칠한다) 평균에 그대로 대면
 * 60% 승률도 '평범', 월드클래스는 사실상 불가능해진다. 그래서 중심 RECENT_CENTER 에서 RECENT_SPREAD 배로 펼친다:
 *   승률 50%·득실 ±0 → ≈5.4(평범) · 60% + 득실 우위 → ≈6.6(수준급) · 80% → ≈7.7 · 90% 대승 위주 → 9+(월드클래스, 드묾)
 *   · 35% + 득실 열세 → ≈3.8(분발 필요). 단위 테스트(scripts/qa-unit-tests.ts)에 고정.
 *
 * 몰수 경기는 matchScore 가 이미 고정값(몰수승 6 / 몰수패 3)을 주므로 그대로 평균에 넣는다
 * (몰수패는 랭크상 실제 패배 — 빼면 잦은 이탈이 폼 점수를 올려주는 역효과).
 */
export const RECENT_CENTER = 5.3;
export const RECENT_SPREAD = 1.8;

export function recentScore(summaries: MatchSummary[]): number {
  if (summaries.length === 0) return 0;
  const mean = summaries.reduce((a, m) => a + matchScore(m), 0) / summaries.length;
  return round1(clamp(RECENT_CENTER + (mean - RECENT_CENTER) * RECENT_SPREAD, 0, 10));
}

export interface ScoreTier {
  label: string;
  tone: 'gold' | 'win' | 'muted' | 'lose';
}

/** 스코어 → 등급 라벨 + 색 토큰. */
export function scoreTier(score: number): ScoreTier {
  if (score >= 8) return { label: '월드클래스', tone: 'gold' };
  if (score >= 6.5) return { label: '수준급', tone: 'win' };
  if (score >= 5) return { label: '평범', tone: 'muted' };
  return { label: '분발 필요', tone: 'lose' };
}
