/**
 * 연승/폼 하이라이트 라벨 (순수 함수). computeMatchPerfStats 결과에서 카드/배너용
 * 한 줄 라벨을 만든다. 카드(next/og)는 이모지 렌더가 불안정하므로 icon은 기하 기호(▲▼◆)만 사용.
 */
export interface StreakInput {
  currentStreak: number; // +연승 / -연패
  bestWinStreak: number;
  momentum: number; // 최근10 승률 - 전체 승률 (%p)
  winRate: number;
}

export interface StreakLabel {
  text: string;
  color: "lime" | "gold" | "lose";
  icon: string; // ▲ / ▼ / ◆ (카드 안전)
}

/** 지금 폼을 한 줄로. 연승>연패>모멘텀>안정 순. */
export function streakLabel(s: StreakInput): StreakLabel {
  if (s.currentStreak >= 5) return { text: `${s.currentStreak}연승 중`, color: "gold", icon: "▲" };
  if (s.currentStreak >= 2) return { text: `${s.currentStreak}연승 중`, color: "lime", icon: "▲" };
  if (s.currentStreak <= -2) return { text: `${Math.abs(s.currentStreak)}연패 중`, color: "lose", icon: "▼" };
  if (s.momentum >= 20) return { text: "폼 상승 중", color: "lime", icon: "▲" };
  if (s.momentum <= -20) return { text: "폼 하락 중", color: "lose", icon: "▼" };
  return { text: "안정적인 폼", color: "lime", icon: "◆" };
}

/** 히어로 배너를 띄울 만한 '사건'이 있는가 (연승/연패 2+ 또는 뚜렷한 모멘텀). */
export function hasStreakHighlight(s: StreakInput): boolean {
  return Math.abs(s.currentStreak) >= 2 || Math.abs(s.momentum) >= 20;
}
