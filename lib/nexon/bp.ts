/**
 * FC온라인 화폐개혁 반영 — 옛 BP 1억(100,000,000)의 가치가 새 BP 1로 재denomination.
 *
 * 넥슨 Open API(`user/trade`)는 개혁 이후에도 **여전히 옛 값**을 반환하므로,
 * 데이터가 앱에 들어오는 경계(getUserTrades)에서 한 번 환산한다. 이후 표시·진단·배지 등
 * 모든 소비처는 새 화폐 값을 그대로 쓴다.
 *
 * 훗날 넥슨이 API 자체를 새 화폐로 바꾸면 `BP_REDENOM` 을 1로 두면 전부(경계 환산 +
 * diagnosis 임계값)가 한 번에 원복된다. 단일 진실 소스.
 */
export const BP_REDENOM = 100_000_000;

/** 옛 BP 값을 새 화폐로 환산. null/NaN 안전. */
export function toNewBp(oldValue: number | null | undefined): number {
  return (oldValue || 0) / BP_REDENOM;
}
