import type { MatchSummary } from './summary';

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
  // 인게임 평균 평점(6.5 기준 가감, 데이터 있을 때만)
  if (m.me.rating > 0) s += clamp(m.me.rating - 6.5, -2, 2) * 0.5;
  // 점유율 소폭
  s += clamp((m.me.possession - 50) / 50, -1, 1) * 0.4;
  return round1(clamp(s, 0, 10));
}

/** 최근 경기 평균 스코어(0~10). 표본 없으면 0. */
export function recentScore(summaries: MatchSummary[]): number {
  if (summaries.length === 0) return 0;
  const total = summaries.reduce((a, m) => a + matchScore(m), 0);
  return round1(total / summaries.length);
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
