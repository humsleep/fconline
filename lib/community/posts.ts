import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { PostType } from './post-types';
import { HOT_TOP, HOT_WINDOW_HOURS, isMissingSchema, rankHot, type HotInput, type PostSort } from './v2';

export interface CommunityPost {
  id: string;
  author_id: string;
  type: PostType;
  title: string;
  body: string;
  region: string | null;
  positions: string[];
  contact: string | null;
  squad_id: string | null;
  meta: Record<string, string>;
  status: string;
  created_at: string;
  /** 0009 마이그레이션 후 존재 — 미실행 환경 대비 optional */
  comment_count?: number;
  /** 0010 마이그레이션 후 존재 — 신고 누적 자동 숨김 */
  hidden?: boolean;
  /** 0023 마이그레이션 후 존재 — 조회수/좋아요 수 */
  view_count?: number;
  like_count?: number;
}

// '*' 선택 — comment_count(0009) 미실행 환경에서도 목록이 죽지 않게
const COLUMNS = '*';

export function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export async function listPosts(opts?: {
  type?: PostType | null;
  /** `types=a,b` — 있으면 type 보다 우선 */
  types?: PostType[] | null;
  region?: string | null;
  limit?: number;
  offset?: number;
  /** 기본 'new'(기존 동작: 모집중 먼저 → 최신). 미지원 환경이면 'new' 로 강등되고 sort 에 실제 적용값이 온다. */
  sort?: PostSort;
}): Promise<{ posts: CommunityPost[]; count: number; sort: PostSort }> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  const types = opts?.types?.length ? opts.types : opts?.type ? [opts.type] : null;
  const sort = opts?.sort ?? 'new';
  try {
    const supabase = await createClient();

    if (sort === 'hot') {
      const ranked = await hotCandidates(types);
      if (ranked) {
        const pageIds = ranked.slice(offset, offset + limit).map((r) => r.id);
        const full = await postsByIds(pageIds);
        return { posts: full, count: ranked.length, sort: 'hot' };
      }
      // 0023 미적용 → 최신순으로 강등
    }

    // count: 'estimated' — 매 요청 정확한 COUNT(*) 스캔 대신 플래너 추정치.
    // 페이지네이션 표시엔 추정치로 충분하고, 작은 결과셋은 여전히 정확.
    const build = (s: PostSort) => {
      let q = supabase.from('community_posts').select(COLUMNS, { count: 'estimated' });
      q =
        s === 'comments'
          ? q.order('comment_count', { ascending: false }).order('created_at', { ascending: false })
          : q
              .order('status', { ascending: false }) // open이 먼저
              .order('created_at', { ascending: false });
      q = q.range(offset, offset + limit - 1);
      if (types?.length === 1) q = q.eq('type', types[0]);
      else if (types?.length) q = q.in('type', types);
      if (opts?.region) q = q.eq('region', opts.region);
      return q;
    };
    let applied: PostSort = sort === 'comments' ? 'comments' : 'new';
    let res = await build(applied);
    if (res.error && applied === 'comments' && isMissingSchema(res.error)) {
      applied = 'new';
      res = await build(applied);
    }
    // 숨김(신고 누적) 제외 — 컬럼 미존재 환경 호환 위해 JS 필터
    const posts = ((res.data as unknown as CommunityPost[]) ?? []).filter((p) => !p.hidden);
    return { posts, count: res.count ?? 0, sort: applied };
  } catch {
    return { posts: [], count: 0, sort: 'new' };
  }
}

const HOT_SCAN = 300;

/**
 * 인기 후보 — 최근 HOT_WINDOW_HOURS 글을 가벼운 컬럼만 읽어 점수순 정렬.
 * 0023(view_count/like_count) 미적용이면 null(기능 꺼짐).
 */
async function hotCandidates(
  types: PostType[] | null
): Promise<HotInput[] | null> {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - HOT_WINDOW_HOURS * 3600_000).toISOString();
    let q = supabase
      .from('community_posts')
      .select('id, created_at, comment_count, like_count, view_count, hidden')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(HOT_SCAN);
    if (types?.length === 1) q = q.eq('type', types[0]);
    else if (types?.length) q = q.in('type', types);
    const { data, error } = await q;
    if (error) return null;
    return rankHot((data as unknown as HotInput[]) ?? [], Date.now());
  } catch {
    return null;
  }
}

async function postsByIds(ids: string[]): Promise<CommunityPost[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from('community_posts').select(COLUMNS).in('id', ids);
  const byId = new Map(((data as unknown as CommunityPost[]) ?? []).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is CommunityPost => Boolean(p && !p.hidden));
}

/**
 * "지금 뜨는 글" TOP 3 — 최근 72시간, likes×3 + comments×2 + views/50, 0점 제외.
 * 0023 미적용이면 null(응답에서 hot 필드를 빼서 앱이 섹션을 숨기게 한다).
 */
export async function hotPosts(types?: PostType[] | null): Promise<CommunityPost[] | null> {
  const ranked = await hotCandidates(types ?? null);
  if (!ranked) return null;
  const top = rankHot(ranked, Date.now(), 0).slice(0, HOT_TOP);
  return postsByIds(top.map((r) => r.id));
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  squad_id: string | null;
  created_at: string;
  hidden?: boolean;
  /** 0023 — 1단 답글이면 원 댓글 id */
  parent_id?: string | null;
  like_count?: number;
}

export async function listComments(postId: string): Promise<CommunityComment[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(200);
    return ((data as CommunityComment[]) ?? []).filter((c) => !c.hidden);
  } catch {
    return [];
  }
}

// React.cache — 같은 렌더 안 중복 호출 dedupe.
// PostDetail은 generateMetadata + 본문에서 getPost(id)를 두 번 호출 → 1 쿼리로 합침.
export const getPost = cache(
  async (id: string): Promise<CommunityPost | null> => {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('community_posts')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();
      return (data as CommunityPost) ?? null;
    } catch {
      return null;
    }
  }
);
