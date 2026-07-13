import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin-auth';
import { formatRelativeKr } from '@/lib/format';
import { ModerateButtons, NoticeForm, SeedForm } from './AdminActions';

export const metadata: Metadata = {
  title: '운영',
  robots: { index: false, follow: false },
};

const REASON_LABEL: Record<string, string> = {
  spam: '스팸',
  abuse: '욕설·비하',
  illegal: '불법·음란',
  other: '기타',
};

interface ReportRow {
  target_type: 'post' | 'comment';
  target_id: string;
  reason: string;
  created_at: string;
}

interface TargetGroup {
  targetType: 'post' | 'comment';
  targetId: string;
  count: number;
  reasons: Record<string, number>;
  latest: string;
  preview: string;
  hidden: boolean;
  postLink: string | null;
}

export default async function AdminPage() {
  // 관리자 인증 (fail-closed) — 아니면 존재 자체를 숨김(404)
  const supabase = await createClient().catch(() => null);
  const user = supabase
    ? (await supabase.auth.getUser()).data.user
    : null;
  if (!user || !isAdminEmail(user.email)) notFound();

  const db = getAdmin();
  if (!db) notFound();

  // 신고 집계 (대상별 그룹)
  let groups: TargetGroup[] = [];
  let currentNotice: string | null = null;
  try {
    const { data: reports } = await db
      .from('reports')
      .select('target_type, target_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(300);

    const map = new Map<string, TargetGroup>();
    for (const r of (reports as ReportRow[]) ?? []) {
      const key = `${r.target_type}:${r.target_id}`;
      const g =
        map.get(key) ??
        ({
          targetType: r.target_type,
          targetId: r.target_id,
          count: 0,
          reasons: {},
          latest: r.created_at,
          preview: '',
          hidden: false,
          postLink: null,
        } as TargetGroup);
      g.count += 1;
      g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
      if (r.created_at > g.latest) g.latest = r.created_at;
      map.set(key, g);
    }
    groups = [...map.values()].sort((a, b) => b.count - a.count);

    // 대상 미리보기 로드
    const postIds = groups.filter((g) => g.targetType === 'post').map((g) => g.targetId);
    const commentIds = groups
      .filter((g) => g.targetType === 'comment')
      .map((g) => g.targetId);
    if (postIds.length > 0) {
      const { data } = await db
        .from('community_posts')
        .select('id, title, hidden')
        .in('id', postIds);
      for (const p of data ?? []) {
        const g = groups.find((x) => x.targetType === 'post' && x.targetId === p.id);
        if (g) {
          g.preview = p.title as string;
          g.hidden = Boolean(p.hidden);
          g.postLink = `/community/${p.id}`;
        }
      }
    }
    if (commentIds.length > 0) {
      const { data } = await db
        .from('community_comments')
        .select('id, body, hidden, post_id')
        .in('id', commentIds);
      for (const c of data ?? []) {
        const g = groups.find(
          (x) => x.targetType === 'comment' && x.targetId === c.id
        );
        if (g) {
          g.preview = (c.body as string).slice(0, 80);
          g.hidden = Boolean(c.hidden);
          g.postLink = `/community/${c.post_id}`;
        }
      }
    }

    const { data: notice } = await db
      .from('notices')
      .select('text')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    currentNotice = (notice?.text as string) ?? null;
  } catch {
    // 테이블 미생성 등 — 빈 화면으로
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold">운영 콘솔</h1>
      <p className="mt-1 text-sm text-muted">{user.email} (관리자)</p>

      {/* 공지 관리 */}
      <section className="panel mt-6 p-5">
        <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
          공지 배너
        </h2>
        <div className="mt-3">
          <NoticeForm current={currentNotice} />
        </div>
      </section>

      {/* 픽 랭킹 시딩 */}
      <section className="panel mt-4 p-5">
        <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
          픽 랭킹 시딩
        </h2>
        <div className="mt-3">
          <SeedForm />
        </div>
      </section>

      {/* 신고 목록 */}
      <section className="panel mt-4 p-5">
        <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
          신고 접수 ({groups.length}건 대상)
        </h2>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-muted">접수된 신고가 없어요. 평화롭네요 ✌️</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {groups.map((g) => (
              <li
                key={`${g.targetType}:${g.targetId}`}
                className="rounded-lg bg-surface-2 p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold ${
                      g.count >= 5 ? 'bg-lose/15 text-lose' : 'bg-gold/15 text-gold'
                    }`}
                  >
                    신고 {g.count}
                  </span>
                  <span className="rounded bg-surface px-1.5 py-0.5 text-muted">
                    {g.targetType === 'post' ? '글' : '댓글'}
                  </span>
                  {g.hidden && (
                    <span className="rounded bg-lose/15 px-1.5 py-0.5 font-semibold text-lose">
                      숨김 중
                    </span>
                  )}
                  <span className="text-muted">
                    {Object.entries(g.reasons)
                      .map(([k, n]) => `${REASON_LABEL[k] ?? k} ${n}`)
                      .join(' · ')}
                  </span>
                  <span className="ml-auto text-muted">
                    {formatRelativeKr(g.latest)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {g.preview || '(삭제된 대상)'}
                  </p>
                  {g.postLink && g.preview && (
                    <Link
                      href={g.postLink}
                      className="flex-none text-[13px] text-accent underline underline-offset-2"
                    >
                      보기
                    </Link>
                  )}
                  {g.preview && (
                    <ModerateButtons
                      targetType={g.targetType}
                      targetId={g.targetId}
                      hidden={g.hidden}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-[13px] text-muted">
        이 페이지는 ADMIN_EMAILS 환경변수에 등록된 계정에만 보여요.
      </p>
    </div>
  );
}
