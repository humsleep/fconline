import Link from 'next/link';
import type { Metadata } from 'next';
import { listPosts } from '@/lib/community/posts';
import { getProfilesByIds } from '@/lib/community/profile';
import {
  POST_TYPES,
  POST_TYPE_ORDER,
  isPostType,
  META_FIELD_LABELS,
  type PostType,
} from '@/lib/community/post-types';
import { formatRelativeKr } from '@/lib/format';

export const metadata: Metadata = {
  title: '커뮤니티',
  description:
    'FC온라인 스쿼드 자랑·평가, 클럽원 모집, 클럽전·대회 커뮤니티.',
};

const PAGE = 20;

const ACCENT_BADGE: Record<'lime' | 'gold' | 'ink', string> = {
  lime: 'bg-accent/10 text-accent',
  gold: 'bg-gold/15 text-gold',
  ink: 'bg-surface-2 text-ink',
};

export default async function CommunityBoard({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const type: PostType | null =
    sp.type && isPostType(sp.type) ? sp.type : null;
  const reqPage = Math.max(1, Math.floor(Number(sp.page ?? 1) || 1));

  const first = await listPosts({
    type,
    limit: PAGE,
    offset: (reqPage - 1) * PAGE,
  });
  const count = first.count;
  const totalPages = Math.max(1, Math.ceil(count / PAGE));
  const page = Math.min(reqPage, totalPages);
  const { posts } =
    page === reqPage
      ? first
      : await listPosts({ type, limit: PAGE, offset: (page - 1) * PAGE });
  const profiles = await getProfilesByIds(posts.map((p) => p.author_id));

  const tabHref = (t: PostType | null) =>
    t ? `/community?type=${t}` : '/community';
  const pageHref = (n: number) =>
    `/community?${type ? `type=${type}&` : ''}page=${n}`;
  const writeHref = `/community/new${type ? `?type=${type}` : ''}`;

  return (
    <div className="mx-auto w-full max-w-3xl pb-28 md:pb-16">
      {/* 헤더 */}
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">커뮤니티</h1>
            <p className="mt-1 text-sm text-muted">
              자랑하고, 평가받고, 모으고, 겨뤄요.
            </p>
          </div>
          {/* 데스크톱 전용 글쓰기 (모바일은 FAB) */}
          <Link
            href={writeHref}
            className="hidden flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink md:block"
          >
            + 글쓰기
          </Link>
        </div>
      </div>

      {/* 유형 필터 — 한 줄 가로 스크롤 (sticky) */}
      {(type !== null || count >= 5) && (
        <div className="sticky top-14 z-30 mt-3 border-b border-line/60 bg-bg/90 backdrop-blur">
          <div className="scrollbar-hide flex gap-1.5 overflow-x-auto px-4 py-2.5">
            <TabChip label="전체" href={tabHref(null)} active={!type} />
            {POST_TYPE_ORDER.map((t) => (
              <TabChip
                key={t}
                label={`${POST_TYPES[t].emoji} ${POST_TYPES[t].label}`}
                href={tabHref(t)}
                active={type === t}
              />
            ))}
          </div>
        </div>
      )}

      {/* 유형 설명 */}
      {type && (
        <p className="mx-4 mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          {POST_TYPES[type].blurb}
        </p>
      )}

      {/* 목록 */}
      <div className="px-4">
        {posts.length === 0 ? (
          <div className="panel mt-4 flex flex-col items-center px-6 py-14 text-center">
            <p className="text-sm text-muted">
              {type
                ? `아직 ${POST_TYPES[type].label} 글이 없어요.`
                : '아직 글이 없어요.'}{' '}
              첫 글의 주인공이 되어보세요!
            </p>
            <Link
              href={writeHref}
              className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
            >
              + 첫 글 쓰기
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {posts.map((p) => {
              const cfg = POST_TYPES[p.type];
              const author = profiles.get(p.author_id);
              const commentCount = p.comment_count ?? 0;
              const preview = p.body.replace(/\s+/g, ' ').trim();
              return (
                <li key={p.id}>
                  <Link
                    href={`/community/${p.id}`}
                    className="panel block p-4 transition active:scale-[0.99] hover:border-accent"
                  >
                    {/* 상단: 유형·상태 배지 */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          'rounded px-1.5 py-0.5 text-[13px] font-semibold ' +
                          ACCENT_BADGE[cfg.accent]
                        }
                      >
                        {cfg.emoji} {cfg.label}
                      </span>
                      {p.status === 'closed' && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px] font-semibold text-muted">
                          마감
                        </span>
                      )}
                      {p.region && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px] text-muted">
                          📍 {p.region}
                        </span>
                      )}
                    </div>

                    {/* 제목 + 본문 미리보기 */}
                    <p className="mt-2 line-clamp-2 text-[16px] font-bold leading-snug">
                      {p.title}
                    </p>
                    {preview && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted">
                        {preview}
                      </p>
                    )}

                    {/* 유형별 부가 정보 */}
                    {(p.positions.length > 0 ||
                      Object.keys(p.meta).length > 0 ||
                      p.squad_id) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {p.squad_id && (
                          <span className="scoreboard rounded bg-accent/10 px-1.5 py-0.5 text-[13px] font-semibold text-accent">
                            🧩 스쿼드
                          </span>
                        )}
                        {p.positions.map((pos) => (
                          <span
                            key={pos}
                            className="scoreboard rounded bg-surface-2 px-1.5 py-0.5 text-[13px] text-muted"
                          >
                            {pos}
                          </span>
                        ))}
                        {Object.entries(p.meta)
                          .slice(0, 2)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className="max-w-[10rem] truncate rounded bg-surface-2 px-1.5 py-0.5 text-[13px] text-muted"
                            >
                              {META_FIELD_LABELS[k] ?? k} {v}
                            </span>
                          ))}
                      </div>
                    )}

                    {/* 푸터: 작성자 · 시간 · 댓글 */}
                    <div className="mt-2.5 flex items-center gap-2 text-[13px] text-muted">
                      <span className="font-semibold text-ink">
                        {author?.nickname ?? '알 수 없음'}
                      </span>
                      {author?.verified_nickname && (
                        <span className="text-accent">✓</span>
                      )}
                      <span>· {formatRelativeKr(p.created_at)}</span>
                      <span
                        className={
                          'ml-auto flex items-center gap-1 font-semibold ' +
                          (commentCount > 0 ? 'text-accent' : 'text-muted')
                        }
                      >
                        💬 {commentCount}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="rounded-lg border border-line px-4 py-2 hover:bg-surface-2"
              >
                이전
              </Link>
            )}
            <span className="text-muted">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="rounded-lg border border-line px-4 py-2 hover:bg-surface-2"
              >
                다음
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 모바일 FAB 글쓰기 — 탭바 위 우하단 고정 */}
      <Link
        href={writeHref}
        aria-label="글쓰기"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-ink shadow-lg transition active:scale-95 md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        ✏️
      </Link>
    </div>
  );
}

function TabChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        'inline-flex min-h-11 flex-none items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ' +
        (active
          ? 'bg-accent font-semibold text-accent-ink'
          : 'bg-surface-2 text-muted hover:text-ink')
      }
    >
      {label}
    </Link>
  );
}
