import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin-auth';
import { formatRelativeKr } from '@/lib/format';
import { ModerateButtons, NoticeForm, SeedForm, PauseToggle } from './AdminActions';

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

  // 넥슨 kill-switch 현재 상태
  let nexonPaused = false;
  try {
    const { data: flag } = await db
      .from('service_flags')
      .select('enabled')
      .eq('key', 'nexon_paused')
      .maybeSingle();
    nexonPaused = Boolean(flag?.enabled);
  } catch {
    // 플래그 테이블 미생성 등 — 정상(false)으로
  }

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

  // 서버 환경변수 점검 (관리자 전용 · 존재 여부만). 앱 출시 준비에서 "넣었는지" 확인이 가장 자주 막힌다.
  const has = (v?: string) => Boolean(v && v.trim());
  const apnsKey = process.env.APNS_PRIVATE_KEY ?? '';
  const siwaKey = process.env.APPLE_SIWA_PRIVATE_KEY ?? '';
  const pem = (v: string) => v.replace(/\\n/g, '\n').includes('-----BEGIN PRIVATE KEY-----');
  const envChecks: { name: string; ok: boolean; warn?: boolean; hint: string }[] = [
    { name: 'ADMIN_EMAILS', ok: has(process.env.ADMIN_EMAILS), hint: '이 화면에 들어올 수 있는 이메일(쉼표 구분). 없으면 아무도 관리자가 아닙니다' },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', ok: has(process.env.SUPABASE_SERVICE_ROLE_KEY), hint: '없으면 이 화면도 안 열립니다' },
    { name: 'NEXON_API_KEY', ok: has(process.env.NEXON_API_KEY), hint: '전적 조회' },
    { name: 'CRON_SECRET', ok: has(process.env.CRON_SECRET), hint: '크론 인증' },
    { name: 'APPLE_TEAM_ID', ok: has(process.env.APPLE_TEAM_ID), hint: '유니버설 링크(AASA)' },
    { name: 'APNS_KEY_ID', ok: has(process.env.APNS_KEY_ID), hint: '푸시 — 10자리 키 ID' },
    { name: 'APNS_TEAM_ID', ok: has(process.env.APNS_TEAM_ID), hint: '푸시 — 팀 ID' },
    { name: 'APNS_BUNDLE_ID', ok: has(process.env.APNS_BUNDLE_ID), hint: '푸시 — 기본 xyz.fcscope.app' },
    { name: 'APNS_PRIVATE_KEY', ok: has(apnsKey) && pem(apnsKey), warn: has(apnsKey) && !pem(apnsKey), hint: has(apnsKey) && !pem(apnsKey) ? '값은 있는데 .p8 형식이 아닙니다(BEGIN PRIVATE KEY 줄 포함 전체를 넣으세요)' : '푸시 — .p8 파일 내용 전체' },
    { name: 'APNS_SANDBOX', ok: !has(process.env.APNS_SANDBOX), warn: has(process.env.APNS_SANDBOX), hint: has(process.env.APNS_SANDBOX) ? '운영에서는 비워 두세요 — 값이 있으면 테스트 서버로 발송돼 기기 토큰이 삭제될 수 있습니다' : '비어 있음(정상)' },
    { name: 'APPLE_SIWA_KEY_ID', ok: has(process.env.APPLE_SIWA_KEY_ID), hint: '계정 삭제 시 Apple 토큰 폐기 — 10자리 키 ID' },
    { name: 'APPLE_SIWA_PRIVATE_KEY', ok: has(siwaKey) && pem(siwaKey), warn: has(siwaKey) && !pem(siwaKey), hint: has(siwaKey) && !pem(siwaKey) ? '값은 있는데 .p8 형식이 아닙니다' : 'Sign in with Apple 키(.p8) 내용 전체' },
    { name: 'ADMOB_PUBLISHER_ID', ok: has(process.env.ADMOB_PUBLISHER_ID), hint: '/app-ads.txt' },
    { name: 'NEXT_PUBLIC_DEMO_NICKNAME', ok: has(process.env.NEXT_PUBLIC_DEMO_NICKNAME), hint: '앱 홈 예시 리포트' },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold">운영 콘솔</h1>
      <p className="mt-1 text-sm text-muted">{user.email} (관리자)</p>

      {/* 넥슨 kill-switch — 한도 소진/장애 시 즉시 정지 */}
      <section className="panel mt-6 p-5">
        <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
          넥슨 조회 스위치
        </h2>
        <div className="mt-3">
          <PauseToggle paused={nexonPaused} />
        </div>
      </section>

      {/* 서버 설정 점검 — 값은 절대 표시하지 않고 "채워졌는지"만 본다 */}
      <section className="panel mt-4 p-5">
        <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
          서버 설정 점검
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {envChecks.map((c) => (
            <li key={c.name} className="flex items-start gap-2">
              <span aria-hidden>{c.ok ? '✅' : c.warn ? '⚠️' : '⬜'}</span>
              <span>
                <b className="text-ink">{c.name}</b>
                <span className="text-muted"> — {c.hint}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          값 자체는 표시하지 않습니다. 바꾼 뒤에는 Vercel 재배포를 해야 반영됩니다.
        </p>
      </section>

      {/* 공지 관리 */}
      <section className="panel mt-4 p-5">
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
