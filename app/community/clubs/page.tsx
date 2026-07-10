import Link from 'next/link';
import type { Metadata } from 'next';
import { listClubPosts } from '@/lib/community/clubs';
import { getProfilesByIds } from '@/lib/community/profile';
import { REGIONS } from '@/lib/community/constants';
import { formatRelativeKr } from '@/lib/format';

export const metadata: Metadata = {
  title: '클럽 모집',
  description: 'FC온라인 함께할 클럽원을 찾는 모집 게시판.',
};

const PAGE = 20;

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const region = sp.region && REGIONS.includes(sp.region as never) ? sp.region : null;
  const reqPage = Math.max(1, Math.floor(Number(sp.page ?? 1) || 1));

  // 먼저 총 개수를 알기 위해 요청 페이지로 조회 후, 범위를 넘으면 클램프
  const first = await listClubPosts({
    region,
    limit: PAGE,
    offset: (reqPage - 1) * PAGE,
  });
  const count = first.count;
  const totalPages = Math.max(1, Math.ceil(count / PAGE));
  const page = Math.min(reqPage, totalPages);
  const { posts } =
    page === reqPage
      ? first
      : await listClubPosts({ region, limit: PAGE, offset: (page - 1) * PAGE });
  const profiles = await getProfilesByIds(posts.map((p) => p.author_id));

  const regionHref = (r: string | null) =>
    r ? `/community/clubs?region=${encodeURIComponent(r)}` : '/community/clubs';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">클럽 모집</h1>
          <p className="mt-1 text-sm text-muted">
            함께 뛸 클럽원을 찾아보세요. 총 {count}개
          </p>
        </div>
        <Link
          href="/community/clubs/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          + 모집 글 쓰기
        </Link>
      </div>

      {/* 지역 필터 */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <FilterChip label="전체" href={regionHref(null)} active={!region} />
        {REGIONS.map((r) => (
          <FilterChip
            key={r}
            label={r}
            href={regionHref(r)}
            active={region === r}
          />
        ))}
      </div>

      {/* 목록 */}
      {posts.length === 0 ? (
        <div className="panel mt-6 px-6 py-16 text-center text-sm text-muted">
          아직 모집 글이 없어요. 첫 글을 남겨보세요!
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {posts.map((p) => {
            const author = profiles.get(p.author_id);
            return (
              <li key={p.id}>
                <Link
                  href={`/community/clubs/${p.id}`}
                  className="panel block p-4 transition hover:border-accent"
                >
                  <div className="flex items-center gap-2">
                    {p.status === 'closed' && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] font-semibold text-muted">
                        마감
                      </span>
                    )}
                    {p.region && (
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[12px] font-semibold text-accent">
                        {p.region}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold">
                      {p.title}
                    </span>
                  </div>
                  {p.positions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.positions.map((pos) => (
                        <span
                          key={pos}
                          className="scoreboard rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-muted"
                        >
                          {pos}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
                    <span className="font-semibold text-ink">
                      {author?.nickname ?? '알 수 없음'}
                    </span>
                    {author?.verified_nickname && (
                      <span className="text-accent">✓ 전적연동</span>
                    )}
                    <span>· {formatRelativeKr(p.created_at)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/community/clubs?${region ? `region=${encodeURIComponent(region)}&` : ''}page=${page - 1}`}
              className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2"
            >
              이전
            </Link>
          )}
          <span className="text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/community/clubs?${region ? `region=${encodeURIComponent(region)}&` : ''}page=${page + 1}`}
              className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2"
            >
              다음
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
        'rounded-full px-3 py-1 text-[13px] font-medium transition ' +
        (active
          ? 'bg-accent text-accent-ink'
          : 'bg-surface-2 text-muted hover:text-ink')
      }
    >
      {label}
    </Link>
  );
}
