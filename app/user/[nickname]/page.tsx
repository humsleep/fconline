import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMaxDivisions, getOuid, getUserBasic, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { NexonApiError, isMaintenance, isNotConfigured, isUserNotFound } from "@/lib/nexon/client";
import { MATCH_TABS, getDivisionName, getMatchTypeName } from "@/lib/nexon/meta";
import { aggregate, summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { formatAchievementDate, formatMatchDate } from "@/lib/format";
import SquadSection from "./SquadSection";
import ShareCardButton from "@/app/components/ShareCardButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nickname: string }>;
}): Promise<Metadata> {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  return {
    title: `${decoded} 전적`,
    description: `${decoded}의 FC온라인 최근 경기 기록, 승률, 슛맵 매치 리포트`,
  };
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ type?: string; view?: string }>;
}) {
  const [{ nickname: raw }, { type, view }] = await Promise.all([
    params,
    searchParams,
  ]);
  const nickname = decodeURIComponent(raw);
  const matchType =
    MATCH_TABS.find((t) => t.type === Number(type))?.type ?? MATCH_TABS[0].type;
  const activeView = view === "squad" ? "squad" : "matches";

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
      {/* 히어로 — 전광판 */}
      <section className="panel rise relative overflow-hidden px-5 py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(200,245,66,0.14), transparent)" }}
        />
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold sm:text-4xl">{basic.nickname}</h1>
          <p className="scoreboard mb-1 text-sm font-semibold text-muted">
            LV.<span className="text-accent">{basic.level}</span>
          </p>
          <Link
            href={`/live/${encodeURIComponent(basic.nickname)}`}
            className="scoreboard mb-0.5 ml-auto inline-flex items-center gap-1.5 rounded-lg bg-lose/15 px-3 py-1.5 text-[13px] font-bold text-lose transition-colors hover:bg-lose/25"
          >
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-lose" />
            라이브 세션
          </Link>
        </div>
        {divisionCards.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {divisionCards.map((d) => (
              <p key={d.matchTypeName} className="text-[12px] text-muted">
                {d.matchTypeName}{" "}
                <span className="font-bold text-gold">{d.divisionName}</span>
                <span className="ml-1 text-[10px]">({d.date})</span>
              </p>
            ))}
          </div>
        )}
        <div className="mt-4">
          <ShareCardButton
            url={`/api/card/user/${encodeURIComponent(basic.nickname)}`}
            filename={`fclab-${basic.nickname}.png`}
            label="전적 카드 저장 · 공유"
          />
        </div>
      </section>

      {/* 매치 종류 탭 */}
      <nav className="rise rise-1 mt-6 flex gap-1.5">
        {MATCH_TABS.map((t) => (
          <Link
            key={t.type}
            href={`/user/${encodeURIComponent(basic.nickname)}?type=${t.type}${
              activeView === "squad" ? "&view=squad" : ""
            }`}
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

      {/* 뷰 서브탭 */}
      <nav className="rise rise-2 mt-2 flex gap-4 border-b border-line/70">
        {(
          [
            { view: "matches", label: "경기 기록" },
            { view: "squad", label: "선수 성적표" },
          ] as const
        ).map((v) => {
          const href = `/user/${encodeURIComponent(basic.nickname)}?type=${matchType}${
            v.view === "squad" ? "&view=squad" : ""
          }`;
          const on = activeView === v.view;
          return (
            <Link
              key={v.view}
              href={href}
              className={`-mb-px border-b-2 px-1 pb-2 text-sm font-semibold transition-colors ${
                on
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>

      {activeView === "squad" ? (
        <Suspense key={`sq-${ouid}-${matchType}`} fallback={<SquadSkeleton />}>
          <SquadSection ouid={ouid} matchType={matchType} />
        </Suspense>
      ) : (
        <Suspense key={`${ouid}-${matchType}`} fallback={<MatchSkeleton />}>
          <MatchSection ouid={ouid} matchType={matchType} />
        </Suspense>
      )}
    </div>
  );
}

const MATCH_COUNT = 30;

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
    if (!(err instanceof NexonApiError)) throw err;
  }

  const details = await getMatchDetailsBatch(matchIds);
  const summaries: MatchSummary[] = [];
  for (const d of details) {
    const s = summarizeMatch(d, ouid);
    if (s) summaries.push(s);
  }

  if (summaries.length === 0) {
    return (
      <div className="panel mt-4 px-6 py-14 text-center text-sm text-muted">
        최근 경기 기록이 없습니다.
      </div>
    );
  }

  const rec = aggregate(summaries);
  const recent10 = summaries.slice(0, 10);

  return (
    <>
      {/* 폼 전광판 */}
      <section className="panel mt-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-medium text-muted">최근 {rec.played}경기 승률</p>
            <p className="scoreboard text-4xl font-bold text-accent">{rec.winRate}%</p>
            <p className="scoreboard mt-0.5 text-xs font-semibold text-muted">
              {rec.win}승 {rec.draw}무 {rec.lose}패
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted">최근 10경기 폼</p>
            <div className="mt-1.5 flex gap-1">
              {recent10.map((m) => (
                <span
                  key={m.matchId}
                  title={`${m.result} ${m.me.goals}:${m.opponent?.goals ?? "-"}`}
                  className={`scoreboard flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${
                    m.result === "승"
                      ? "bg-win/15 text-win"
                      : m.result === "패"
                        ? "bg-lose/15 text-lose"
                        : "bg-draw/15 text-draw"
                  }`}
                >
                  {m.result}
                </span>
              ))}
            </div>
          </div>
          <div className="min-w-32">
            <p className="text-[10px] font-medium text-muted">경기 평점 흐름</p>
            <RatingSparkline values={[...summaries].reverse().map((m) => m.me.rating)} />
          </div>
        </div>
      </section>

      {/* 스탯 타일 */}
      <section className="mt-2 grid grid-cols-3 gap-2">
        <StatTile label="득점 / 실점" value={`${rec.goalsFor} / ${rec.goalsAgainst}`} />
        <StatTile label="경기당 득점" value={(rec.goalsFor / rec.played).toFixed(1)} />
        <StatTile label="평균 점유율" value={`${rec.avgPossession}%`} />
      </section>

      {/* 경기 리스트 */}
      <ul className="mt-4 space-y-1.5">
        {summaries.map((m) => (
          <li key={m.matchId}>
            <MatchRow m={m} ouid={ouid} />
          </li>
        ))}
      </ul>
    </>
  );
}

function RatingSparkline({ values }: { values: number[] }) {
  const pts = values.filter((v) => v > 0);
  if (pts.length < 2) return <p className="mt-2 text-xs text-muted">데이터 부족</p>;

  const w = 128;
  const h = 36;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const points = pts
    .map(
      (v, i) =>
        `${(i / (pts.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`
    )
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-9 w-32" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-3 py-2.5">
      <p className="text-[10px] font-medium text-muted">{label}</p>
      <p className="scoreboard mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}

function MatchRow({ m, ouid }: { m: MatchSummary; ouid: string }) {
  const badge =
    m.result === "승" ? "badge-win" : m.result === "패" ? "badge-lose" : "badge-draw";

  return (
    <Link
      href={`/match/${encodeURIComponent(m.matchId)}?me=${encodeURIComponent(ouid)}`}
      className="panel group flex items-center gap-3 px-3.5 py-3 transition-colors hover:border-accent/40"
    >
      <span className={`badge-result ${badge}`}>{m.result}</span>

      <div className="scoreboard flex items-center gap-2 text-lg font-bold">
        <span>{m.me.goals}</span>
        <span className="text-xs text-muted">:</span>
        <span className="text-muted">{m.opponent?.goals ?? "-"}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {m.opponent ? `vs ${m.opponent.nickname}` : "상대 정보 없음"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          {formatMatchDate(m.matchDate)}
          {m.forfeit && <span className="ml-1.5 text-lose">몰수</span>}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-[10px] text-muted">평점</p>
        <p className="scoreboard text-sm font-semibold">
          {m.me.rating > 0 ? m.me.rating.toFixed(1) : "-"}
        </p>
      </div>

      <span className="scoreboard text-xs font-bold text-muted transition-colors group-hover:text-accent">
        리포트 →
      </span>
    </Link>
  );
}

function MatchSkeleton() {
  return (
    <div className="mt-4 space-y-1.5" aria-label="경기 기록 불러오는 중">
      <div className="skeleton h-24" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton h-[62px]" />
      ))}
      <p className="pt-2 text-center text-xs text-muted">
        넥슨 서버에서 최근 {MATCH_COUNT}경기를 불러오는 중… 첫 조회는 시간이 걸릴 수 있어요.
      </p>
    </div>
  );
}

function SquadSkeleton() {
  return (
    <div className="mt-7 space-y-3" aria-label="선수 성적표 불러오는 중">
      <div className="skeleton h-3 w-64" />
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-[72px]" />
        ))}
      </div>
      <p className="pt-2 text-center text-xs text-muted">
        선수별 기록과 랭커 평균을 계산하는 중…
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
