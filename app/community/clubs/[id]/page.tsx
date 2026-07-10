import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getClubPost } from '@/lib/community/clubs';
import { getProfilesByIds } from '@/lib/community/profile';
import { createClient } from '@/lib/supabase/server';
import { formatRelativeKr } from '@/lib/format';
import ClubPostActions from './ClubPostActions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getClubPost(id);
  return { title: post ? `${post.title} · 클럽 모집` : '클럽 모집' };
}

export default async function ClubPostDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getClubPost(id);
  if (!post) notFound();

  const profiles = await getProfilesByIds([post.author_id]);
  const author = profiles.get(post.author_id);

  let isOwner = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isOwner = Boolean(user && user.id === post.author_id);
  } catch {
    // 익명 조회
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/community/clubs"
        className="text-[13px] text-muted underline underline-offset-2"
      >
        ← 클럽 모집 목록
      </Link>

      <article className="panel mt-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          {post.status === 'closed' && (
            <span className="rounded bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-muted">
              마감
            </span>
          )}
          {post.region && (
            <span className="rounded bg-accent/10 px-2 py-0.5 text-[12px] font-semibold text-accent">
              {post.region}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold">{post.title}</h1>
        <p className="mt-1 text-[12px] text-muted">
          {formatRelativeKr(post.created_at)}
        </p>

        {post.positions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.positions.map((p) => (
              <span
                key={p}
                className="scoreboard rounded-lg bg-surface-2 px-2 py-1 text-[13px] font-semibold text-ink"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">
          {post.body}
        </p>

        {post.play_style && (
          <p className="mt-4 text-sm">
            <span className="font-semibold text-muted">지향 플레이 </span>
            {post.play_style}
          </p>
        )}
        {post.contact && (
          <p className="mt-2 text-sm">
            <span className="font-semibold text-muted">연락 </span>
            <span className="break-all">{post.contact}</span>
          </p>
        )}

        {isOwner && <ClubPostActions id={post.id} status={post.status} />}
      </article>

      {/* 작성자 카드 — 구단주명 연동 시 전적 자동 첨부 */}
      <section className="panel mt-4 p-5">
        <p className="scoreboard text-[12px] font-semibold tracking-[0.2em] text-muted">
          작성자
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold">{author?.nickname ?? '알 수 없음'}</p>
            {author?.verified_nickname ? (
              <p className="text-[13px] text-accent">
                ✓ FC Online: {author.verified_nickname}
              </p>
            ) : (
              <p className="text-[13px] text-muted">구단주명 미연동</p>
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
