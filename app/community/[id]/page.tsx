import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPost, listComments } from '@/lib/community/posts';
import { getProfilesByIds } from '@/lib/community/profile';
import { createClient } from '@/lib/supabase/server';
import { formatRelativeKr } from '@/lib/format';
import { POST_TYPES, META_FIELD_LABELS } from '@/lib/community/post-types';
import PostActions from './PostActions';
import Comments, { type CommentView } from './Comments';
import ReportButton from '@/app/components/ReportButton';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: '커뮤니티' };
  return { title: `${post.title} · ${POST_TYPES[post.type].label}` };
}

export default async function PostDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  const cfg = POST_TYPES[post.type];
  const comments = await listComments(post.id);
  const profiles = await getProfilesByIds([
    post.author_id,
    ...comments.map((c) => c.author_id),
  ]);
  const author = profiles.get(post.author_id);

  let isOwner = false;
  let loggedIn = false;
  let canComment = false;
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    loggedIn = Boolean(user);
    isOwner = Boolean(user && user.id === post.author_id);
    canComment = Boolean(user && profiles.get(user.id)?.nickname);
    if (user && !profiles.has(user.id)) {
      // 댓글 작성자 목록에 없더라도 내 프로필(닉네임 보유 여부)은 별도 확인
      const { data: me } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      canComment = Boolean(me?.nickname);
    }
  } catch {
    // 익명 조회
  }

  const commentViews: CommentView[] = comments.map((c) => ({
    id: c.id,
    body: c.body,
    squad_id: c.squad_id,
    created_at: c.created_at,
    authorName: profiles.get(c.author_id)?.nickname ?? '알 수 없음',
    isOwn: Boolean(userId && c.author_id === userId),
  }));

  // 신고 누적 자동 숨김 — 본인·관리 확인용 외 노출 차단
  if (post.hidden && !isOwner) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
        <h1 className="text-xl font-bold">숨김 처리된 글이에요</h1>
        <p className="mt-2 text-sm text-muted">
          신고 누적으로 노출이 중단됐어요. 문제가 있다고 생각되면 문의해 주세요.
        </p>
        <Link
          href="/community"
          className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink"
        >
          커뮤니티로
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:pb-16">
      <Link
        href={`/community?type=${post.type}`}
        className="text-sm text-muted underline underline-offset-2"
      >
        ← {cfg.label} 목록
      </Link>

      <article className="panel mt-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-surface-2 px-2 py-0.5 text-[13px] font-semibold text-ink">
            {cfg.emoji} {cfg.label}
          </span>
          {post.hidden && (
            <span className="rounded bg-lose/15 px-2 py-0.5 text-[13px] font-semibold text-lose">
              신고 누적 숨김 (본인에게만 표시)
            </span>
          )}
          {post.status === 'closed' && (
            <span className="rounded bg-surface-2 px-2 py-0.5 text-[13px] font-semibold text-muted">
              마감
            </span>
          )}
          {post.region && (
            <span className="rounded bg-accent/10 px-2 py-0.5 text-[13px] font-semibold text-accent">
              📍 {post.region}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold">{post.title}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {formatRelativeKr(post.created_at)}
        </p>

        {/* 모집 포지션 */}
        {post.positions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.positions.map((p) => (
              <span
                key={p}
                className="scoreboard rounded-lg bg-surface-2 px-2 py-1 text-sm font-semibold text-ink"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* 유형별 메타 */}
        {Object.keys(post.meta).length > 0 && (
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(post.meta).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="text-[13px] text-muted">
                  {META_FIELD_LABELS[k] ?? k}
                </dt>
                <dd className="text-sm font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">
          {post.body}
        </p>

        {/* 첨부 스쿼드 */}
        {post.squad_id && (
          <Link
            href={`/squad/${encodeURIComponent(post.squad_id)}`}
            className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 transition hover:border-accent"
          >
            <span className="text-sm font-semibold">🧩 첨부된 스쿼드 보기</span>
            <span className="text-sm text-accent">열기 →</span>
          </Link>
        )}

        {post.contact && (
          <p className="mt-4 text-sm">
            <span className="font-semibold text-muted">연락 </span>
            <span className="break-all">{post.contact}</span>
          </p>
        )}

        {isOwner ? (
          <PostActions id={post.id} status={post.status} />
        ) : (
          <div className="mt-6 flex justify-end border-t border-line pt-4">
            <ReportButton targetType="post" targetId={post.id} />
          </div>
        )}
      </article>

      {/* 댓글 — 평가/제안이 오가는 핵심 루프 */}
      <Comments
        postId={post.id}
        comments={commentViews}
        canWrite={canComment}
        loggedIn={loggedIn}
      />

      {/* 작성자 카드 */}
      <section className="panel mt-4 p-5">
        <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
          작성자
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold">{author?.nickname ?? '알 수 없음'}</p>
            {author?.verified_nickname ? (
              <p className="text-sm text-accent">
                ✓ FC Online: {author.verified_nickname}
              </p>
            ) : (
              <p className="text-sm text-muted">구단주명 미연동</p>
            )}
          </div>
          {author?.verified_nickname && (
            <Link
              href={`/user/${encodeURIComponent(author.verified_nickname)}`}
              className="flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              전적·진단 보기
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
