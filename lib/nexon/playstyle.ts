/**
 * 랭커 실사용 평균 스탯 → 카드 플레이스타일 배지 (순수 함수).
 * ranker-stats status의 확정 필드만 사용(경기당 평균): goal/assist/pass/dribble/tackle/block.
 * 지배적 성향 1개만 반환(없으면 null) — 과잉 라벨 방지.
 */
export interface PlaystyleInput {
  goal: number; // 경기당
  assist: number;
  passTry: number;
  passSuccess: number;
  dribbleTry: number;
  dribbleSuccess: number;
  tackle: number;
  block: number;
}

export interface Playstyle {
  label: string;
  emoji: string;
  tone: 'gold' | 'win' | 'muted';
}

export function playstyleOf(s: PlaystyleInput): Playstyle | null {
  const passRate = s.passTry > 0 ? (s.passSuccess / s.passTry) * 100 : 0;
  const dribRate = s.dribbleTry > 0 ? (s.dribbleSuccess / s.dribbleTry) * 100 : 0;
  const defence = s.tackle + s.block;

  // 우선순위: 결정력 → 개인기 → 연계 → 수비 (하나만)
  if (s.goal >= 0.4) return { label: '결정력형', emoji: '⚽', tone: 'gold' };
  if (dribRate >= 70 && s.dribbleTry >= 3)
    return { label: '개인기형', emoji: '✨', tone: 'win' };
  if (passRate >= 85 && s.assist >= 0.2)
    return { label: '연계형', emoji: '🎯', tone: 'win' };
  if (defence >= 3) return { label: '수비형', emoji: '🛡️', tone: 'muted' };
  return null;
}
