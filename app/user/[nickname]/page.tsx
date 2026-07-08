import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMaxDivisions, getOuid, getUserBasic, getUserMatches, getMatchDetail } from "@/lib/nexon/api";
import { NexonApiError, isMaintenance, isNotConfigured, isUserNotFound } from "@/lib/nexon/client";
import { MATCH_TABS, getDivisionName, getMatchTypeName } from "@/lib/nexon/meta";
import { aggregate, summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { formatAchievementDate, formatMatchDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nickname: string }>;
}): Promise<Metadata> {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  return {
    title: `${decoded} 전적`,
    description: `${decoded}의 FC온라인 최근 경기 기록과 통계`,
  };
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ nickname: raw }, { type }] = await Promise.all([params, searchParams]);
  const nickname = decodeURIComponent(raw);
  const matchType =
    MATCH_TABS.find((t) => t.type === Number(type))?.type ?? MATCH_TABS[0].type;

  let ouid: string;
  try {
    ouid = await getOuid(nickname);
  } catch (err) {
    return <ErrorState err={err} nickname={nickname} />;
  }

  const basic = await getUserBasic(ouid);
  const divisions = await getMaxDivisions(ouid).catch(() => []);
  const divisionCards = await Promise.all(
    divisions.slice(0, 3).map(async (d) => ({
      matchTypeName: await getMatchTypeName(d.matchType),
      divisionName: await getDivisionName(d.division),
      date: formatAchievementDate(d.achievementDate),
    }))
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      {/* 프로필 */}
      <section className="rise flex flex-wrap items-end gap-x-4 gap-y-2">
        <h1 className="text-3xl font-bold sm:text-4xl">{basic.nickname}</h1>
        <p className="scoreboard mb-1 text-sm font-semibold text-muted">
          LV.<span className="text-accent">{basic.level}</span>
        </p>
      </section>

      {/* 역대 최고 등급 */}
      {divisionCards.length > 0 && (
        <section className="rise rise-1 mt-5 grid gap-2 sm:grid-cols-3">
          {divisionCards.map((d) => (
            <div key={d.matchTypeName} className="panel px-4 py-3">
              <p className="text-[11px] font-medium text-muted">
                {d.matchTypeName} 최고 등급
              </p>
              <p className="mt-1 font-bold text-gold">{d.divisionName}</p>
              <p className="mt-0.5 text-[11px] text-muted">{d.date} 달성</p>
            </div>
          ))}
        </section>
      )}

      {/* 매치 종류 탭 */}
      <nav className="rise rise-2 mt-8 flex gap-1.5">
        {MATCH_TABS.map((t) => (
          <Link
            key={t.type}
            href={`/user/${encodeURIComponent(basic.nickname)}?type=${t.type}`}
            className={`scoreboard rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              t.type === matchType
                ? "bg-accent text-accent-ink"
                : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Suspense key={`${ouid}-${matchType}`} fallback={<MatchSkeleton />}>
        <MatchSection ouid={ouid} matchType={matchType} />
      </Suspense>
    </div>
  );
}

const MATCH_COUNT = 10;

async function MatchSection({
  ouid,
  matchType,
}: {
  ouid: string;
  matchType: number;
}) {
  let matchIds: string[] = [];
  try {
    matchIds = await getUserMatches(ouid, matchType, MATCH_COUNT);
  } catch (err) {
    // 데이터 준비 중(00009) 등은 빈 목록으로 처리
    if (!(err instanceof NexonApiError)) throw err;
  }

  const summaries: MatchSummary[] = [];
  for (const id of matchIds) {
    try {
      const s = summarizeMatch(await getMatchDetail(id), ouid);
      if (s) summaries.push(s);
    } catch {
      // 닉네임 변경 반영 대기 등으로 개별 매치 조회가 실패할 수 있음 → 건너뜀
    }
  }

  if (summaries.length === 0) {
    return (
      <div className="panel mt-4 px-6 py-14 text-center text-sm text-muted">
        최근 경기 기록이 없습니다.
      </div>
    );
  }

  const rec = aggregate(summaries);

  return (
    <>
      {/* 요약 전광판 */}
      <section className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <StatTile label={`최근 ${rec.played}경기`} value={`${rec.win}승 ${rec.draw}무 ${rec.lose}패`} small />
        <StatTile label="승률" value={`${rec.winRate}%`} accent />
        <StatTile label="득점 / 실점" value={`${rec.goalsFor} / ${rec.goalsAgainst}`} />
        <StatTile label="평균 점유율" value={`${rec.avgPossession}%`} />
        <StatTile
          label="경기당 득점"
          value={(rec.goalsFor / rec.played).toFixed(1)}
        />
      </section>

      {/* 경기 리스트 */}
      <ul className="mt-4 space-y-1.5">
        {summaries.map((m) => (
          <li key={m.matchId}>
            <MatchRow m={m} />
          </li>
        ))}
      </ul>
    </>
  );
}

function StatTile({
  label,
  value,
  accent = false,
  small = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div className="panel px-3 py-2.5">
      <p className="text-[10px] font-medium text-muted">{label}</p>
      <p
        className={`scoreboard mt-0.5 font-bold ${small ? "text-sm" : "text-lg"} ${
          accent ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MatchRow({ m }: { m: MatchSummary }) {
  const badge =
    m.result === "승" ? "badge-win" : m.result === "패" ? "badge-lose" : "badge-draw";

  return (
    <div className="panel flex items-center gap-3 px-3.5 py-3">
      <span className={`badge-result ${badge}`}>{m.result}</span>

      <div className="scoreboard flex items-center gap-2 text-lg font-bold">
        <span>{m.me.goals}</span>
        <span className="text-xs text-muted">:</span>
        <span className="text-muted">{m.opponent?.goals ?? "-"}</span>
      </div>

      <div className="min-w-0 flex-1">
        {m.opponent ? (
          <Link
            href={`/user/${encodeURIComponent(m.opponent.nickname)}`}
            className="block truncate text-sm font-medium transition-colors hover:text-accent"
          >
            vs {m.opponent.nickname}
          </Link>
        ) : (
          <span className="text-sm text-muted">상대 정보 없음</span>
        )}
        <p className="mt-0.5 text-[11px] text-muted">
          {formatMatchDate(m.matchDate)}
          {m.forfeit && <span className="ml-1.5 text-lose">몰수</span>}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-[10px] text-muted">점유율</p>
        <p className="scoreboard text-sm font-semibold">{m.me.possession}%</p>
      </div>
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div className="mt-4 space-y-1.5" aria-label="경기 기록 불러오는 중">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`skeleton h-16 ${i > 2 ? "hidden sm:block" : ""}`} />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-[62px]" />
      ))}
      <p className="pt-2 text-center text-xs text-muted">
        넥슨 서버에서 경기 기록을 불러오는 중…
      </p>
    </div>
  );
}

function ErrorState({ err, nickname }: { err: unknown; nickname: string }) {
  let title = "일시적인 오류가 발생했어요";
  let desc = "잠시 후 다시 시도해주세요.";

  if (isUserNotFound(err)) {
    title = `‘${nickname}’ 구단주를 찾을 수 없어요`;
    desc = "닉네임 철자를 확인해주세요. 최근에 닉네임을 변경했다면 넥슨 반영까지 시간이 걸릴 수 있습니다.";
  } else if (isNotConfigured(err)) {
    title = "서비스 준비 중입니다";
    desc = "넥슨 API 연동 설정이 완료되지 않았습니다. (NEXON_API_KEY 미설정)";
  } else if (isMaintenance(err)) {
    title = "게임 점검 중입니다";
    desc = "점검이 끝나면 다시 조회할 수 있어요.";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p className="scoreboard text-5xl font-bold text-surface-2">4:04</p>
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{desc}</p>
      <Link
        href="/"
        className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
      >
        다시 검색
      </Link>
    </div>
  );
}
