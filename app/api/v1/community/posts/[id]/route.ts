import { getPost, listComments } from '@/lib/community/posts';
import { getProfilesByIds } from '@/lib/community/profile';
import { getOperatorIds } from '@/lib/community/operators';
import { createClient } from '@/lib/supabase/server';
import { POST_TYPES, META_FIELD_LABELS } from '@/lib/community/post-types';
import { apiError, ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

/** GET /api/v1/community/posts/:id — 글 + 댓글 + 작성자 + 내 권한(소유/댓글 가능). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return apiError('not_found', '글을 찾을 수 없어요.', 404);
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
  const author = profiles.get(post.author_id);
  return ok({
    post: {
      ...post,
      typeLabel: POST_TYPES[post.type]?.label ?? post.type,
      typeEmoji: POST_TYPES[post.type]?.emoji ?? '📝',
      author: { id: post.author_id, nickname: author?.nickname ?? '알 수 없음', verifiedNickname: author?.verified_nickname ?? null, isOperator: operators.has(post.author_id) },
      metaRows: Object.entries(post.meta)
        .filter(([k]) => k !== 'squad_b')
        .map(([k, v]) => ({ key: k, label: META_FIELD_LABELS[k] ?? k, value: v })),
      squadB: typeof post.meta.squad_b === 'string' ? post.meta.squad_b : null,
    },
    comments: comments.map((c) => ({
      ...c,
      author: { id: c.author_id, nickname: profiles.get(c.author_id)?.nickname ?? '알 수 없음', isOperator: operators.has(c.author_id) },
      isOwn: Boolean(userId && c.author_id === userId),
    })),
    viewer: { loggedIn: Boolean(userId), isOwner, canComment },
  });
}
