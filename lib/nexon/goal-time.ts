/**
 * shootDetail.goalTime 디코딩 — 순수 함수.
 *
 * 넥슨은 goalTime 에 "몇 번째 하프인지"를 상위 비트로 싣는다. 값 = 하프 오프셋 + 그 하프 시작 후 경과 초.
 *   전반        0          + s   → 표시 분 = s/60
 *   후반        2^24       + s   → 45  + s/60
 *   연장 전반   2^25       + s   → 90  + s/60
 *   연장 후반   2^25+2^24  + s   → 105 + s/60
 *   승부차기    2^26 이상         → 120 (경기 시계 없음)
 * 라이브 실측(2026-09-18, 공식경기 80경기·슛 1,157개): 후반 값은 16777216+(0~2984)초,
 * 연장은 33554432+(148~628)초 / 50331648+(192~1212)초로 확인 — 하프 경과 초이지 경기 누적 초가 아니다.
 * 예전 코드는 goalTime/60 을 그대로 써서 후반 슛이 "279,629분"으로 찍혔다.
 */

export const HALF_BIT = 2 ** 24; // 16,777,216

/** 하프 인덱스 → 그 하프가 시작하는 경기 시계(분). */
const HALF_START_MIN = [0, 45, 90, 105] as const;
const SHOOTOUT_MIN = 120;

/** goalTime 을 {하프 인덱스(0 전반 · 1 후반 · 2 연장전반 · 3 연장후반 · 4+ 승부차기), 하프 경과 초} 로. */
export function splitGoalTime(goalTime: number): { half: number; seconds: number } {
  if (!Number.isFinite(goalTime) || goalTime < 0) return { half: 0, seconds: 0 };
  const half = Math.floor(goalTime / HALF_BIT);
  return { half, seconds: goalTime - half * HALF_BIT };
}

/** 경기 시계 기준 분(소수). 전반 추가시간은 45 를 넘을 수 있다(예: 47.6). */
export function goalMinuteExact(goalTime: number): number {
  const { half, seconds } = splitGoalTime(goalTime);
  if (half >= HALF_START_MIN.length) return SHOOTOUT_MIN;
  return HALF_START_MIN[half] + seconds / 60;
}

/**
 * 화면 표시용 정수 분 — 축구 관례대로 "n분째"(0~59초 = 1분). 0 은 나오지 않는다.
 * 후반 시작 직후 슛은 46', 연장 전반 시작 직후는 91'.
 */
export function goalMinute(goalTime: number): number {
  const { half } = splitGoalTime(goalTime);
  if (half >= HALF_START_MIN.length) return SHOOTOUT_MIN;
  return Math.floor(goalMinuteExact(goalTime)) + 1;
}
