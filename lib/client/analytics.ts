/**
 * GA4 이벤트 + UTM 캡처 (클라이언트). gtag는 layout에서 NEXT_PUBLIC_GA_ID 설정 시에만
 * 로드되므로, 미설정 환경에선 track()이 조용히 no-op이 된다(에러 없음).
 * 인스타 홍보 퍼널(IG 링크 → 검색 → 카드 공유) 전환을 첫날부터 측정하기 위함.
 */

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

/** GA4 커스텀 이벤트 전송. gtag 미로드/서버면 무시. 절대 throw 안 함. */
export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    window.gtag?.('event', event, params ?? {});
  } catch {
    // 측정 실패는 조용히 무시 — 기능에 영향 주지 않음
  }
}

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const UTM_STORE_KEY = 'fcscope-utm';

/**
 * 최초 진입 URL의 utm_* 를 캡처해 localStorage에 저장하고 campaign_landing 이벤트 전송.
 * (GA4가 세션에 자동 귀속하지만, 명시 이벤트로 유입 소스를 확실히 남긴다.)
 * utm 파라미터가 없으면 아무것도 하지 않아 기존 저장값을 보존한다.
 */
export function captureUtm(): void {
  if (typeof window === 'undefined') return;
  try {
    const sp = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = sp.get(k);
      if (v) utm[k] = v.slice(0, 120); // 방어적 길이 제한
    }
    if (Object.keys(utm).length === 0) return;
    localStorage.setItem(UTM_STORE_KEY, JSON.stringify(utm));
    track('campaign_landing', utm);
  } catch {
    // localStorage 차단(사파리 프라이빗 등) — 무시
  }
}

/** 저장된 유입 UTM(있으면). 다른 이벤트에 소스를 함께 실어보낼 때 사용. */
export function storedUtm(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(UTM_STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}
