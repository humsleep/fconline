/**
 * 커뮤니티 글 첨부 — "내 전적 카드"(record) · "VS 카드"(versus).
 *
 * 저장은 기존 `meta`(jsonb, **문자열 값만**)에 평평한 키로 한다:
 *   attach_kind = 'record' | 'versus', attach_me, attach_with(versus 전용), attach_mode('50'|'52'|'40')
 *
 * 왜 중첩 객체가 아닌가: 배포된 iOS 앱은 `meta` 를 `[String: String]`(필수)로 디코딩한다.
 * `meta.attach = {...}` 를 넣으면 그 글이 포함된 목록·상세 디코딩이 통째로 실패해 구버전 앱이 깨진다.
 * 평평한 문자열 키는 구버전이 그대로 무시한다(/api/v1 은 필드 추가만 — AGENTS.md).
 * 대신 메타 표(`metaRows`)·웹 메타 칩에서는 이 키들을 빼야 "attach_kind record" 같은 행이 안 보인다.
 *
 * 카드는 저장하지 않는다 — 구단주명만 저장하고 화면이 열 때마다 최신 전적으로 그린다(라이브).
 */

export type AttachKind = 'record' | 'versus';
export type PostAttach = { kind: AttachKind; me: string; with: string | null; mode: number };

export const ATTACH_KEYS = ['attach_kind', 'attach_me', 'attach_with', 'attach_mode'] as const;
const ATTACH_KEY_SET = new Set<string>(ATTACH_KEYS);
const MODES = new Set([50, 52, 40]);

/** 메타 표·칩에서 숨길 키(배틀 B팀 내부 값 + 첨부 키) */
export function isHiddenMetaKey(k: string): boolean {
  return k === 'squad_b' || ATTACH_KEY_SET.has(k);
}

/** 표시용 메타 항목 — 숨김 키를 뺀 [키, 값] */
export function publicMetaEntries(meta: Record<string, unknown> | null | undefined): [string, string][] {
  return Object.entries(meta ?? {})
    .filter(([k, v]) => !isHiddenMetaKey(k) && typeof v === 'string')
    .map(([k, v]) => [k, v as string]);
}

/**
 * 구단주명 검증 — 넥슨 닉네임은 한글·영문·숫자 위주. 경로·쿼리를 오염시킬 문자와 공백·제어문자를 막고 길이만 제한한다.
 * NFC 로 합친다(입력 경로에 따라 자모 분리 NFD 로 들어오면 같은 닉이 다른 문자열이 된다).
 */
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFC').trim();
  if (s.length < 1 || s.length > 20) return null;
  if (/[\s/\\?#%&<>"'`]/u.test(s)) return null;
  if (/\p{Cc}/u.test(s)) return null;
  return s;
}

/**
 * 같은 구단주인가 — `cleanNickname` 을 거친 값(NFC·trim)끼리 **대소문자만 무시**하고 비교한다.
 * iOS `PostAttach.sameNickname` 이 같은 규칙(lowercased 비교)을 쓴다 — 한쪽을 바꾸면 다른 쪽도 바꿀 것.
 */
export function sameNickname(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * 작성 요청의 `attach` 를 meta 항목으로. 없거나 형식이 틀리면 null.
 * 작성 라우트는 attach 를 보냈는데 null 이면 400 으로 이유를 돌려준다(조용히 첨부만 빠지지 않게).
 */
export function parseAttachInput(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind === 'record' || o.kind === 'versus' ? (o.kind as AttachKind) : null;
  if (!kind) return null;
  const me = cleanNickname(o.me);
  if (!me) return null;
  const modeNum = Number(o.mode ?? 50);
  const mode = MODES.has(modeNum) ? modeNum : 50;
  const out: Record<string, string> = { attach_kind: kind, attach_me: me, attach_mode: String(mode) };
  if (kind === 'versus') {
    const w = cleanNickname(o.with);
    if (!w || sameNickname(w, me)) return null;
    out.attach_with = w;
  }
  return out;
}

/** 저장된 meta → 첨부(없거나 깨졌으면 null) */
export function readAttach(meta: Record<string, unknown> | null | undefined): PostAttach | null {
  if (!meta) return null;
  const kind = meta.attach_kind === 'record' || meta.attach_kind === 'versus' ? (meta.attach_kind as AttachKind) : null;
  const me = cleanNickname(meta.attach_me);
  if (!kind || !me) return null;
  const with_ = kind === 'versus' ? cleanNickname(meta.attach_with) : null;
  if (kind === 'versus' && !with_) return null;
  const m = Number(meta.attach_mode ?? 50);
  return { kind, me, with: with_, mode: MODES.has(m) ? m : 50 };
}

/** 기존 meta 에서 첨부 키만 골라낸다(글 수정 때 보존용 — 수정 폼은 첨부를 다루지 않는다) */
export function pickAttachMeta(meta: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ATTACH_KEYS) {
    const v = meta?.[k];
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}
