/**
 * 넥슨 오류 분류 — 서버 의존성 없는 순수 함수(단위 테스트 대상).
 * 분류 관례: err.name + err.status + message regex (production minify 대응, instanceof 비의존).
 */

/** 넥슨 match-detail 의 matchId 형식(24자리 소문자 hex). 형식이 틀리면 넥슨을 부르지 않는다. */
export const MATCH_ID_RE = /^[0-9a-f]{24}$/;

const OPENAPI_CODE_RE = /^OPENAPI\d{5}$/;
const INVALID_PARAM_MSG_RE = /valid (parameter|identifier)|유효하지 않은 (식별자|파라미터)|파라미터 (누락|오류)/i;

/**
 * `/id?nickname=` 단계의 실패가 "그런 구단주 없음"인가.
 *
 * 넥슨은 존재하지 않는 닉네임에 404 가 아니라 **HTTP 400 + OPENAPI00004("valid parameter")** 를
 * 돌려주는 경우가 있다(OPENAPI00003 만 보던 시절 앱·웹이 502 "데이터를 불러오지 못했어요"로 떨어졌다).
 * 닉네임이 유일한 파라미터인 이 단계에서만 "파라미터 오류 = 없는 닉네임"으로 읽는다 —
 * 다른 단계(match-detail 등)에 이 규칙을 쓰면 우리 쪽 버그를 not-found 로 숨기게 된다.
 *
 * 절대 not-found 로 읽지 않는 것: 400 이 아닌 상태(5xx·429·타임아웃), 그리고
 * 00003/00004 외의 알려진 OPENAPI 코드(00005 키 오류, 00009 데이터 준비 중, 00010/11 점검 등).
 * 코드가 OPENAPI 형식이 아닐 때(본문 파싱 실패 등)만 메시지로 판별한다.
 */
export function isOuidLookupNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; status?: unknown; code?: unknown; message?: unknown };
  if (e.name !== 'NexonApiError' || e.status !== 400) return false;
  const code = typeof e.code === 'string' ? e.code : '';
  if (code === 'OPENAPI00003' || code === 'OPENAPI00004') return true;
  if (OPENAPI_CODE_RE.test(code)) return false;
  return INVALID_PARAM_MSG_RE.test(typeof e.message === 'string' ? e.message : '');
}
