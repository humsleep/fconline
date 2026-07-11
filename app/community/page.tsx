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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">커뮤니티</h1>
          <p className="mt-1 text-sm text-muted">
            자랑하고, 평가받고, 모으고, 겨뤄요.
          </p>
        </div>
        <Link
          href={`/community/new${type ? `?type=${type}` : ''}`}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          + 글쓰기
        </Link>
      </div>

      {/* 유형 탭 — 글이 거의 없을 땐 빈 필터만 늘어놓지 않는다(콜드스타트) */}
      {(type !== null || count >= 5) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
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
      )}

      {/* 유형 설명 */}
      {type && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">
          {POST_TYPES[type].blurb}
        </p>
      )}

      {/* 목록 */}
      {posts.length === 0 ? (
        <div className="panel mt-6 flex flex-col items-center px-6 py-14 text-center">
          <p className="text-sm text-muted">
            {type
              ? `아직 ${POST_TYPES[type].label} 글이 없어요.`
              : '아직 글이 없어요.'}{' '}
            첫 글의 주인공이 되어보세요!
          </p>
          <Link
            href={`/community/new${type ? `?type=${type}` : ''}`}
            className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
          >
            + 첫 글 쓰기
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {posts.map((p) => {
            const cfg = POST_TYPES[p.type];
            const author = profiles.get(p.author_id);
            return (
              <li key={p.id}>
                <Link
                  href={`/community/${p.id}`}
                  className="panel block p-4 transition hover:border-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        'rounded px-1.5 py-0.5 text-[12px] font-semibold ' +
                        ACCENT_BADGE[cfg.accent]
                      }
                    >
                      {cfg.emoji} {cfg.label}
                    </span>
                    {p.status === 'closed' && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] font-semibold text-muted">
                        마감
                      </span>
                    )}
                    {p.region && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-muted">
                        📍 {p.region}
                      </span>
                    )}
                    {p.squad_id && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-muted">
                        스쿼드 첨부
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-[15px] font-bold">{p.title}</p>

                  {/* 유형별 스니펫 */}
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
                  {Object.keys(p.meta).length > 0 && (
                    <p className="mt-1.5 truncate text-[12px] text-muted">
                      {Object.entries(p.meta)
                        .map(([k, v]) => `${META_FIELD_LABELS[k] ?? k}: ${v}`)
                        .join(' · ')}
                    </p>
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

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
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
              href={pageHref(page + 1)}
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
