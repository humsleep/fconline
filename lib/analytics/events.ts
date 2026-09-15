/**
 * 앱 사용 기록 검증 — 서버 의존성 없는 순수 함수(단위 테스트 대상).
 *
 * 공개 엔드포인트라 누구나 호출할 수 있다. 그래서 받은 값을 그대로 저장하지 않는다:
 * 이벤트 이름은 허용 목록만, props 는 원시값 몇 개만, 시각은 그럴듯한 범위로 자른다.
 * 거부보다 **정리**를 택한다 — 앱 구버전이 모르는 필드를 보내도 나머지는 살린다.
 */

export const EVENT_NAMES = new Set([
  'app_open',
  'search',
  'record_view',
  'section_view',
  'match_view',
  'card_create',
  'card_share',
  'interstitial',
  'favorite_add',
  'account_delete',
]);

/**
 * 요청당 이벤트 상한. 앱(fcscope-ios Analytics.swift)은 요청당 최대 20개를 보낸다(2026-09 출시 전 변경).
 * ⚠️ 앱보다 작게 내리지 말 것 — 앱은 200 을 받으면 보낸 만큼 큐에서 지우므로, 서버가 덜 받으면 나머지가 조용히 사라진다.
 * (출시 전이라 50개씩 보내던 구버전 앱은 배포된 적 없다.)
 */
export const MAX_EVENTS = 20;
const MAX_PROPS = 8;
const MAX_STR = 60;
const ENVS = new Set(['debug', 'testflight', 'appstore']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^[a-z_]{1,24}$/;

export type PropValue = string | number | boolean;

export interface CleanEvent {
  name: string;
  props: Record<string, PropValue>;
  at: string;
}

export interface CleanBatch {
  installId: string;
  appVersion: string | null;
  env: string;
  events: CleanEvent[];
}

function cleanProps(raw: unknown): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_PROPS) break;
    if (!KEY_RE.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, MAX_STR);
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** 기기 시계가 틀리거나 오래 쌓인 이벤트는 받은 시각으로 대체한다(미래 5분 초과·7일 이전). */
function cleanAt(raw: unknown, now: number): string {
  const t = typeof raw === 'string' ? Date.parse(raw) : NaN;
  if (!Number.isFinite(t) || t > now + 5 * 60_000 || t < now - 7 * 86_400_000) return new Date(now).toISOString();
  return new Date(t).toISOString();
}

/** 유효한 배치면 정리된 값을, 설치 ID 가 없거나 형식이 틀리면 null. */
export function sanitizeEvents(input: unknown, now = Date.now()): CleanBatch | null {
  if (!input || typeof input !== 'object') return null;
  const b = input as Record<string, unknown>;
  if (typeof b.installId !== 'string' || !UUID_RE.test(b.installId)) return null;
  const list = Array.isArray(b.events) ? b.events.slice(0, MAX_EVENTS) : [];
  const events: CleanEvent[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const ev = e as Record<string, unknown>;
    if (typeof ev.name !== 'string' || !EVENT_NAMES.has(ev.name)) continue;
    events.push({ name: ev.name, props: cleanProps(ev.props), at: cleanAt(ev.at, now) });
  }
  return {
    installId: b.installId.toLowerCase(),
    appVersion: typeof b.appVersion === 'string' ? b.appVersion.slice(0, 20) : null,
    env: typeof b.env === 'string' && ENVS.has(b.env) ? b.env : 'unknown',
    events,
  };
}
