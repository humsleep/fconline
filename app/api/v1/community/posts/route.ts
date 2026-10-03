import { listPosts, hotPosts, type CommunityPost } from '@/lib/community/posts';
import { getProfilesByIds } from '@/lib/community/profile';
import { getOperatorIds } from '@/lib/community/operators';
import { likedIds, viewerId } from '@/lib/community/engagement';
import { parseSort, parseTypes } from '@/lib/community/v2';
import { POST_TYPES, POST_TYPE_ORDER, isPostType, type PostType } from '@/lib/community/post-types';
import { ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

const PAGE = 20;

/**
 * GET /api/v1/community/posts?type=&types=a,b&sort=new|hot|comments&page=
 * 목록 + 작성자 프로필 + 유형 메타.
 *
 * v2 추가(전부 옵셔널 — 구버전 앱은 모르는 키를 무시한다):
 * - `sort`: 실제 적용된 정렬. hot/comments 를 요청해도 0023 미적용이면 'new' 로 온다.
 * - `hot`: 1페이지에서만, 최근 72시간 TOP 3("지금 뜨는 글"). 0023 미적용·2페이지 이후엔 키 자체가 없다.
 * - posts[].view_count / like_count (0023 후), posts[].viewerLiked (로그인 + 0023 후)
 * - types[].shortLabel
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const typeRaw = sp.get('type');
  const type: PostType | null = typeRaw && isPostType(typeRaw) ? typeRaw : null;
  const types = parseTypes(sp.get('types'));
  const sort = parseSort(sp.get('sort'));
  const page = Math.max(1, Math.floor(Number(sp.get('page') ?? 1) || 1));
  const filter = types ?? (type ? [type] : null);

  const [{ posts, count, sort: applied }, hot, uid] = await Promise.all([
    listPosts({ types: filter, limit: PAGE, offset: (page - 1) * PAGE, sort }),
    page === 1 ? hotPosts(filter) : Promise.resolve(null),
    viewerId(),
  ]);
  const all = [...posts, ...(hot ?? [])];
  const authorIds = all.map((p) => p.author_id);
  const [profiles, operators, liked] = await Promise.all([
    getProfilesByIds(authorIds),
    getOperatorIds(authorIds),
    likedIds('post', uid, [...new Set(all.map((p) => p.id))]),
  ]);

  const view = (p: CommunityPost) => {
    const a = profiles.get(p.author_id);
    return {
      ...p,
      author: { id: p.author_id, nickname: a?.nickname ?? '알 수 없음', verifiedNickname: a?.verified_nickname ?? null, isOperator: operators.has(p.author_id) },
      typeLabel: POST_TYPES[p.type]?.label ?? p.type,
      typeEmoji: POST_TYPES[p.type]?.emoji ?? '📝',
      preview: p.body.replace(/\s+/g, ' ').trim().slice(0, 120),
      ...(liked ? { viewerLiked: liked.has(p.id) } : {}),
    };
  };

  return ok({
    page,
    totalPages: Math.max(1, Math.ceil(count / PAGE)),
    sort: applied,
    types: POST_TYPE_ORDER.map((t) => ({
      type: t,
      label: POST_TYPES[t].label,
      shortLabel: POST_TYPES[t].shortLabel,
      emoji: POST_TYPES[t].emoji,
      blurb: POST_TYPES[t].blurb,
      accent: POST_TYPES[t].accent,
      fields: POST_TYPES[t].fields,
      template: POST_TYPES[t].template,
      bodyLabel: POST_TYPES[t].bodyLabel,
      bodyPlaceholder: POST_TYPES[t].bodyPlaceholder,
    })),
    posts: posts.map(view),
    ...(hot ? { hot: hot.map(view) } : {}),
  });
}
