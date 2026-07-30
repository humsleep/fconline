import 'server-only';

/**
 * Supabase 접속 서킷 브레이커.
 *
 * DB가 불통이면(크래시 루프·재시작 등) 매 요청이 재접속을 시도해 복구를
 * 지연시키는 "재연결 폭풍"이 생긴다(장애 로그: 초당 5~10건 재연결). 연속 실패가
 * 임계를 넘으면 짧은 쿨다운 동안 DB 호출을 아예 건너뛰고(fast-fail) 폴백으로
 * 즉시 응답 → 회복 중인 DB에 얹히는 커넥션 부하를 줄인다.
 *
 * 인스턴스(서버리스 워커)별 in-memory 상태 — 별도 인프라 불필요.
 */

const FAIL_THRESHOLD = 5; // 연속 실패 임계
const COOLDOWN_MS = 5_000; // open 유지(쿨다운 후 다음 호출이 자연스럽게 half-open 재시도)

let consecutiveFailures = 0;
let openUntil = 0;

/** 현재 서킷이 열려(open) 있으면 true — 이때는 DB를 치지 않는다. */
export function isCircuitOpen(): boolean {
  return Date.now() < openUntil;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAIL_THRESHOLD) {
    openUntil = Date.now() + COOLDOWN_MS;
  }
}

/**
 * Supabase 쿼리를 서킷 브레이커로 감싼다.
 * - 서킷 open: DB를 치지 않고 null 반환 → 호출부는 기존 폴백(캐시 미스/ fail-open)으로 처리.
 * - 실행 시 throw 하거나 결과에 error 가 있으면 실패로 집계, 성공하면 회복.
 * 반환: 쿼리 결과({ data, error, ... }) 또는 null.
 */
export async function guardDb<T extends { error: unknown }>(
  run: () => PromiseLike<T>
): Promise<T | null> {
  if (isCircuitOpen()) return null;
  try {
    const res = await run();
    if (res.error) recordFailure();
    else recordSuccess();
    return res;
  } catch {
    recordFailure();
    return null;
  }
}
