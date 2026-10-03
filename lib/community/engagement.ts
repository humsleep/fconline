import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { isBotUA } from './v2';

/**
 * 조회수 +1 (RPC 한 번). 봇 UA 는 건너뛴다. 증가 후 조회수를 돌려준다.
 * 0023 미적용(함수 없음)·실패·숨김 글이면 null — 호출부는 원래 값을 그대로 쓴다.
 */
export async function recordView(postId: string, userAgent: string | null): Promise<number | null> {
  if (isBotUA(userAgent)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('increment_post_view', { p_id: postId });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
}

/**
 * 로그인 사용자가 좋아요한 글/댓글 id 집합. 비로그인·0023 미적용이면 null(viewerLiked 를 빼라는 뜻).
 * RLS(본인 행만 select)라 user_id 조건은 사실상 중복이지만 인덱스(user_id)를 타게 명시한다.
 */
export async function likedIds(
  kind: 'post' | 'comment',
  userId: string | null,
  ids: string[]
): Promise<Set<string> | null> {
  if (!userId) return null;
  if (ids.length === 0) return new Set();
  try {
    const supabase = await createClient();
    const table = kind === 'post' ? 'post_likes' : 'comment_likes';
    const col = kind === 'post' ? 'post_id' : 'comment_id';
    const { data, error } = await supabase.from(table).select(col).eq('user_id', userId).in(col, ids);
    if (error) return null;
    return new Set(((data as Record<string, string>[]) ?? []).map((r) => r[col]));
  } catch {
    return null;
  }
}

/** 현재 요청의 로그인 사용자 id(쿠키 또는 Bearer). 없으면 null. */
export async function viewerId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
