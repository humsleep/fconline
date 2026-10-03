/**
 * 커뮤니티 v2 순수 로직(조회수 봇 필터 · 정렬/유형 파싱 · 인기 점수 · 답글 평면화).
 * DB·네트워크 없음 — 단위 테스트 대상(scripts/qa-unit-tests.ts).
 */
import { isPostType, type PostType } from './post-types';

export type PostSort = 'new' | 'hot' | 'comments';

export function parseSort(v: string | null | undefined): PostSort {
  return v === 'hot' || v === 'comments' ? v : 'new';
}

/** `types=a,b` — 알려진 유형만, 중복 제거, 순서 유지. 비면 null(전체). */
export function parseTypes(v: string | null | undefined): PostType[] | null {
  if (!v) return null;
  const out: PostType[] = [];
  for (const raw of v.split(',')) {
    const t = raw.trim();
    if (t && isPostType(t) && !out.includes(t)) out.push(t);
  }
  return out.length ? out : null;
}

/** 크롤러·링크 미리보기·스크립트는 조회수에서 뺀다. UA 가 없으면 사람이 아니라고 본다. */
const BOT_RE =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|kakaotalk-scrap|preview|embedly|whatsapp|telegram|discord|slack|curl|wget|python|httpx|axios|node-fetch|undici|go-http|java\/|okhttp|headless|lighthouse|pagespeed|monitor|uptime|scrap/i;

export function isBotUA(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 8) return true;
  return BOT_RE.test(ua);
}

/** 인기 점수 창(시간) — 이 안의 글만 hot 후보. */
export const HOT_WINDOW_HOURS = 72;
export const HOT_TOP = 3;

export interface HotInput {
  id: string;
  created_at: string;
  like_count?: number | null;
  comment_count?: number | null;
  view_count?: number | null;
  hidden?: boolean | null;
}

/** likes×3 + comments×2 + views/50 */
export function hotScore(p: Pick<HotInput, 'like_count' | 'comment_count' | 'view_count'>): number {
  return (p.like_count ?? 0) * 3 + (p.comment_count ?? 0) * 2 + (p.view_count ?? 0) / 50;
}

/**
 * 인기순 정렬 — 창 안 · 숨김 제외 · 점수 내림차순(동점은 최신 먼저).
 * minScore 보다 낮은 글은 뺀다(`hot[]` 처럼 "뜨는 글"만 보여 줄 때 0 점짜리를 거른다).
 */
export function rankHot<T extends HotInput>(rows: T[], nowMs: number, minScore = -1): T[] {
  const since = nowMs - HOT_WINDOW_HOURS * 3600_000;
  return rows
    .filter((r) => !r.hidden && Date.parse(r.created_at) >= since)
    .map((r) => ({ r, s: hotScore(r) }))
    .filter((x) => x.s > minScore)
    .sort((a, b) => b.s - a.s || Date.parse(b.r.created_at) - Date.parse(a.r.created_at))
    .map((x) => x.r);
}

/** 답글 대상 → 실제로 붙일 원 댓글 id(1단 평면화). 다른 글의 댓글이면 null. */
export function resolveReplyParent(
  target: { id: string; post_id: string; parent_id?: string | null } | null,
  postId: string
): string | null {
  if (!target || target.post_id !== postId) return null;
  return target.parent_id || target.id;
}

/** Postgres/PostgREST 의 "아직 마이그레이션 안 됨" 오류 — 기능만 끄고 계속 진행한다. */
export function isMissingSchema(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false;
  const c = err.code ?? '';
  if (c === '42703' || c === '42P01' || c === '42883' || c === 'PGRST202' || c === 'PGRST204' || c === 'PGRST205')
    return true;
  return /does not exist|could not find the .* (column|function|table)|schema cache/i.test(err.message ?? '');
}
