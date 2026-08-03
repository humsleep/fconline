/**
 * 폼 추세(재방문 훅) 순수 계산 유틸 — user_snapshots(승률·평점)의 시계열을
 * 스파크라인/축하 배지로 그리기 위한 값만 계산한다. DB·React 의존 없음(테스트 가능).
 * 마이그레이션 불필요 — 기존 win_rate/avg_rating 컬럼을 그대로 사용.
 */

export interface FormPoint {
  date: string;
  winRate: number;
  avgRating: number;
}

/**
 * 마지막 값 기준 "직전 대비 연속 상승" 구간 길이.
 * 예: [50,55,60] → 2, [60,55] → 0, 표본 <2 → 0.
 */
export function risingStreak(values: number[]): number {
  let streak = 0;
  for (let i = values.length - 1; i > 0; i--) {
    if (values[i] > values[i - 1]) streak++;
    else break;
  }
  return streak;
}

/**
 * 마지막 값이 표본 내 최고치인가(동률 최고 포함). 단, 전부 같은 값(평평)은 최고로 보지 않음.
 * 표본 <2 → false.
 */
export function isPeak(values: number[]): boolean {
  if (values.length < 2) return false;
  const last = values[values.length - 1];
  const max = Math.max(...values);
  const min = Math.min(...values);
  return last >= max && last > min;
}

/**
 * SVG polyline `points` 문자열. min~max로 정규화하고 위/아래 pad를 남긴다.
 * 값이 모두 같으면 중앙 수평선. 표본 <2 → 빈 문자열(호출부에서 렌더 스킵).
 */
export function sparklinePoints(
  values: number[],
  w: number,
  h: number,
  pad = 3
): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min; // 전부 동일 → 바닥이 아니라 세로 중앙 수평선
  const span = max - min || 1;
  const usable = h - pad * 2;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = flat ? h / 2 : h - pad - ((v - min) / span) * usable;
      return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    })
    .join(' ');
}
