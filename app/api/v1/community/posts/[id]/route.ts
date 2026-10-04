import { getPost, listComments } from '@/lib/community/posts';
import { getProfilesByIds } from '@/lib/community/profile';
import { getOperatorIds } from '@/lib/community/operators';
import { createClient } from '@/lib/supabase/server';
import { likedIds, recordView } from '@/lib/community/engagement';
import { POST_TYPES, META_FIELD_LABELS } from '@/lib/community/post-types';
import { apiError, ok } from '@/lib/api/v1';
import { publicMetaEntries } from '@/lib/community/attach';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/community/posts/:id — 글 + 댓글 + 작성자 + 내 권한(소유/댓글 가능).
 *
 * v2 추가(옵셔널): post.view_count/like_count/viewerLiked, comments[].parent_id/like_count/viewerLiked,
 * comments[].author.verifiedNickname. 조회수는 이 GET 에서 +1(봇 UA 제외) — 응답에는 증가 후 값.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 조회수 증가는 글 조회와 병렬(RPC 한 번). 없는 글·숨김 글이면 null 이 돌아와 아무것도 안 바뀐다.
  const [post, views] = await Promise.all([getPost(id), recordView(id, req.headers.get('user-agent'))]);
  if (!post) return apiError('not_found', '글을 찾을 수 없어요.', 404);
  if (views !== null) post.view_count = views;
  const comments = await listComments(post.id);
  const authorIds = [post.author_id, ...comments.map((c) => c.author_id)];
  const [profiles, operators] = await Promise.all([getProfilesByIds(authorIds), getOperatorIds(authorIds)]);

  let userId: string | null = null;
  let canComment = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    if (user) {
      const mine = profiles.get(user.id);
      if (mine) canComment = Boolean(mine.nickname);
      else {
        const { data: me } = await supabase.from('profiles').select('nickname').eq('id', user.id).maybeSingle();
        canComment = Boolean(me?.nickname);
      }
    }
  } catch {
    // 익명
  }
  const isOwner = Boolean(userId && userId === post.author_id);
  if (post.hidden && !isOwner) return apiError('not_found', '신고 누적으로 숨김 처리된 글이에요.', 404);
  const [likedPost, likedComments] = await Promise.all([
    likedIds('post', userId, [post.id]),
    likedIds('comment', userId, comments.map((c) => c.id)),
  ]);
  const author = profiles.get(post.author_id);
  return ok({
    post: {
      ...post,
      typeLabel: POST_TYPES[post.type]?.label ?? post.type,
      typeEmoji: POST_TYPES[post.type]?.emoji ?? '📝',
      author: { id: post.author_id, nickname: author?.nickname ?? '알 수 없음', verifiedNickname: author?.verified_nickname ?? null, isOperator: operators.has(post.author_id) },
      // 첨부 키(attach_*)·배틀 B팀은 표에서 뺀다 — 구버전 앱이 "attach_kind record" 행을 그리지 않게
      metaRows: publicMetaEntries(post.meta)
        .map(([k, v]) => ({ key: k, label: META_FIELD_LABELS[k] ?? k, value: v })),
      squadB: typeof post.meta.squad_b === 'string' ? post.meta.squad_b : null,
      ...(likedPost ? { viewerLiked: likedPost.has(post.id) } : {}),
    },
    comments: comments.map((c) => ({
      ...c,
      author: {
        id: c.author_id,
        nickname: profiles.get(c.author_id)?.nickname ?? '알 수 없음',
        verifiedNickname: profiles.get(c.author_id)?.verified_nickname ?? null,
        isOperator: operators.has(c.author_id),
      },
      isOwn: Boolean(userId && c.author_id === userId),
      ...(likedComments ? { viewerLiked: likedComments.has(c.id) } : {}),
    })),
    viewer: { loggedIn: Boolean(userId), isOwner, canComment },
  });
}
