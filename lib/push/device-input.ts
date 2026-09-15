/**
 * POST /api/v1/devices 입력 정리 — 서버 의존성 없는 순수 함수(단위 테스트 대상).
 * 공개 엔드포인트라 받은 문자열을 그대로 저장하지 않는다(거부보다 정리 — 앱 구버전 호환).
 */

export const DEVICE_TEXT_MAX = 40;
export const FAVORITES_MAX = 12;
/** 거대한 배열을 끝까지 훑지 않도록 보는 원소 수 상한 */
const FAVORITES_SCAN = 100;

/** 제어문자(C0·C1)·zero-width·줄/문단 구분자·방향 제어(bidi) */
function isControl(cp: number): boolean {
  return (
    cp <= 0x1f ||
    (cp >= 0x7f && cp <= 0x9f) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x2028 && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x2069) ||
    cp === 0xfeff
  );
}

/** 문자열이면 제어문자 제거 → trim → 최대 길이(코드포인트 기준) → 비면 null. */
export function cleanDeviceText(v: unknown, max = DEVICE_TEXT_MAX): string | null {
  if (typeof v !== 'string') return null;
  const chars = Array.from(v).filter((ch) => !isControl(ch.codePointAt(0) ?? 0));
  const s = Array.from(chars.join('').trim()).slice(0, max).join('').trim();
  return s || null;
}

/** 즐겨찾기 닉네임: 항목별 정리, 빈 값 제거, 중복 제거(첫 등장 유지), 최대 12개. */
export function sanitizeFavorites(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const f of v.slice(0, FAVORITES_SCAN)) {
    const s = cleanDeviceText(f);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= FAVORITES_MAX) break;
  }
  return out;
}
