import { listPosts } from '@/lib/community/posts';
import { getProfilesByIds } from '@/lib/community/profile';
import { getOperatorIds } from '@/lib/community/operators';
import { POST_TYPES, POST_TYPE_ORDER, isPostType, type PostType } from '@/lib/community/post-types';
import { ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

const PAGE = 20;

/** GET /api/v1/community/posts?type=&page= — 목록 + 작성자 프로필 + 유형 메타. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const typeRaw = sp.get('type');
  const type: PostType | null = typeRaw && isPostType(typeRaw) ? typeRaw : null;
  const page = Math.max(1, Math.floor(Number(sp.get('page') ?? 1) || 1));
  const { posts, count } = await listPosts({ type, limit: PAGE, offset: (page - 1) * PAGE });
  const [profiles, operators] = await Promise.all([getProfilesByIds(posts.map((p) => p.author_id)), getOperatorIds(posts.map((p) => p.author_id))]);
  return ok({
    page,
    totalPages: Math.max(1, Math.ceil(count / PAGE)),
    types: POST_TYPE_ORDER.map((t) => ({
      type: t,
      label: POST_TYPES[t].label,
      emoji: POST_TYPES[t].emoji,
      blurb: POST_TYPES[t].blurb,
      accent: POST_TYPES[t].accent,
      fields: POST_TYPES[t].fields,
      template: POST_TYPES[t].template,
      bodyLabel: POST_TYPES[t].bodyLabel,
      bodyPlaceholder: POST_TYPES[t].bodyPlaceholder,
    })),
    posts: posts.map((p) => {
      const a = profiles.get(p.author_id);
      return {
        ...p,
        author: { id: p.author_id, nickname: a?.nickname ?? '알 수 없음', verifiedNickname: a?.verified_nickname ?? null, isOperator: operators.has(p.author_id) },
        typeLabel: POST_TYPES[p.type]?.label ?? p.type,
        typeEmoji: POST_TYPES[p.type]?.emoji ?? '📝',
        preview: p.body.replace(/\s+/g, ' ').trim().slice(0, 120),
      };
    }),
  });
}
