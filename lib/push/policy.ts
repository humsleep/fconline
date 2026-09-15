/**
 * 푸시 발송 정책 — 서버 의존성 없는 순수 함수(단위 테스트 대상).
 */

export const APNS_PRODUCTION = 'https://api.push.apple.com';
export const APNS_SANDBOX = 'https://api.sandbox.push.apple.com';

/**
 * APNS_SANDBOX 해석 — '1' 또는 'true' 일 때만 샌드박스.
 * 예전엔 truthy 검사라 "0"/"false" 도 샌드박스로 가서, 운영 토큰이 전부 BadDeviceToken 으로 보였다
 * (→ 무효 토큰 정리가 device_tokens 를 비울 수 있었다).
 */
export function apnsHost(sandboxEnv: string | undefined): string {
  const v = (sandboxEnv ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' ? APNS_SANDBOX : APNS_PRODUCTION;
}

export interface PushResult {
  token: string;
  /** HTTP 상태. 0 = 네트워크/세션 오류·타임아웃(APNs 판정 아님 → 절대 삭제 대상 아님) */
  status: number;
  reason?: string;
}

/** 무효 토큰 판별(삭제 후보) */
export function isDeadToken(r: PushResult): boolean {
  return r.status === 410 || (r.status === 400 && (r.reason === 'BadDeviceToken' || r.reason === 'DeviceTokenNotForTopic'));
}

/** 서킷 브레이커: 이만큼 이상 보낸 실행에서 */
export const DEAD_BREAKER_MIN_BATCH = 5;
/** 무효 판정이 이 비율을 넘으면 삭제하지 않는다 */
export const DEAD_BREAKER_MAX_RATIO = 0.5;

/**
 * 무효 토큰을 지워도 되는가.
 * 실제 기기가 한 번에 절반 넘게 죽는 일은 없다 — 그렇게 보이면 환경 설정 오류(샌드박스/번들 ID/키)다.
 * 그 상태로 지우면 첫 크론이 device_tokens 를 통째로 비우므로, 삭제를 건너뛰고 결과에 보고한다.
 */
export function deadTokenDecision(total: number, dead: number): { delete: boolean; tripped: boolean } {
  if (dead <= 0 || total <= 0) return { delete: false, tripped: false };
  const tripped = total >= DEAD_BREAKER_MIN_BATCH && dead / total > DEAD_BREAKER_MAX_RATIO;
  return { delete: !tripped, tripped };
}
