import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SearchForm from "@/app/components/SearchForm";
import { DEMO_NICKNAME } from "@/lib/demo";
import { getMaxDivisions, getOuid, getUserBasic } from "@/lib/nexon/api";
import { isMaintenance, isNotConfigured, isPaused, isRateLimited, isTimeout, isUserNotFound } from "@/lib/nexon/client";
import { MATCH_TABS, getDivisionName, getMatchTypeName } from "@/lib/nexon/meta";
import { aggregate, summarizeMatch, topRivals, type MatchSummary, type Rival } from "@/lib/nexon/summary";
import { formatAchievementDate, formatMatchDate } from "@/lib/format";
import SquadSection from "./SquadSection";
import PlaystyleSection from "./PlaystyleSection";
import ReportSection from "./ReportSection";
import VisitRecorder from "./VisitRecorder";
import HeroBadges from "./HeroBadges";
import ShareCardButton from "@/app/components/ShareCardButton";
import { getRecentMatchDetails } from "@/lib/nexon/recent";
import { computeMatchPerfStats, diagnoseMatchPerf } from "@/lib/match/diagnosis";
import { TONE_BG, TONE_DOT, TONE_TEXT } from "@/lib/diagnosis/tone";

export const maxDuration = 60; // 콜드 조회: 매치 상세 최대 30건 순차 호출 대비

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
  // 이적시장은 매치 종류와 무관 → 독립 페이지로 이동 (기존 링크 호환)
  if (view === "market") redirect(`/market/${encodeURIComponent(nickname)}`);
  const matchType =
    MATCH_TABS.find((t) => t.type === Number(type))?.type ?? MATCH_TABS[0].type;
  const activeView =
    view === "squad"
      ? "squad"
      : view === "style"
        ? "style"
        : view === "report"
          ? "report"
          : "matches";

  let ouid: string;
  let basic: Awaited<ReturnType<typeof getUserBasic>>;
  try {
    ouid = await getOuid(nickname);
    // getUserBasic이 첫 '실제' 넥슨 호출인 경우가 많다(getOuid는 데이터 캐시 히트 가능).
    // 여기서 보호하지 않으면 429/점검/타임아웃이 맞춤 ErrorState 대신 generic error로 추락.
    basic = await getUserBasic(ouid);
  } catch (err) {
    return <ErrorState err={err} nickname={nickname} />;
  }

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
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <h1 className="text-3xl font-bold sm:text-4xl">{basic.nickname}</h1>
          <p className="scoreboard mb-1 text-sm font-semibold text-muted">
            LV.<span className="text-accent">{basic.level}</span>
          </p>
          {/* 성향 배지 — 공식경기 유형 + 이적시장 유형 (스트리밍) */}
          <div className="mb-0.5 ml-auto">
            <Suspense
              fallback={
                <span className="skeleton inline-block h-8 w-44 rounded-lg" aria-hidden />
              }
            >
              <HeroBadges ouid={ouid} nickname={basic.nickname} />
            </Suspense>
          </div>
        </div>
        {divisionCards.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {divisionCards.map((d) => (
              <p key={d.matchTypeName} className="text-[13px] text-muted">
                {d.matchTypeName}{" "}
                <span className="font-bold text-gold">{d.divisionName}</span>
                <span className="ml-1 text-[13px]">({d.date})</span>
              </p>
            ))}
          </div>
        )}
      </section>

      {/* 매치 종류 탭 + 이적시장 진입 */}
      <nav className="rise rise-1 mt-6 flex flex-wrap items-center gap-1.5">
        {MATCH_TABS.map((t) => (
          <Link
            key={t.type}
            href={`/user/${encodeURIComponent(basic.nickname)}?type=${t.type}${
              activeView === "matches" ? "" : `&view=${activeView}`
            }`}
            className={`scoreboard rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              t.type === matchType
                ? "bg-accent text-accent-ink"
                : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <Link
          href={`/market/${encodeURIComponent(basic.nickname)}`}
          className="scoreboard ml-auto rounded-lg bg-gold/15 px-3.5 py-1.5 text-sm font-bold text-gold transition-colors hover:bg-gold/25"
        >
          💰 이적시장
        </Link>
      </nav>

      {/* 뷰 서브탭 */}
      <nav className="scrollbar-hide rise rise-2 mt-2 flex gap-4 overflow-x-auto border-b border-line/70">
        {(
          [
            { view: "matches", label: "경기 기록" },
            { view: "report", label: "분석" },
            { view: "squad", label: "선수 성적표" },
            { view: "style", label: "플레이스타일" },
          ] as const
        ).map((v) => {
          const href = `/user/${encodeURIComponent(basic.nickname)}?type=${matchType}${
            v.view === "matches" ? "" : `&view=${v.view}`
          }`;
          const on = activeView === v.view;
          return (
            <Link
              key={v.view}
              href={href}
              className={`-mb-px flex-none whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-semibold transition-colors ${
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
      ) : activeView === "style" ? (
        <Suspense key={`st-${ouid}-${matchType}`} fallback={<SquadSkeleton />}>
          <PlaystyleSection ouid={ouid} matchType={matchType} />
        </Suspense>
      ) : activeView === "report" ? (
        <Suspense key={`rp-${ouid}-${matchType}`} fallback={<SquadSkeleton />}>
          <ReportSection ouid={ouid} matchType={matchType} />
        </Suspense>
      ) : (
        <Suspense key={`${ouid}-${matchType}`} fallback={<MatchSkeleton />}>
          <MatchSection ouid={ouid} matchType={matchType} nickname={basic.nickname} />
        </Suspense>
      )}

      {/* 전적 카드 저장·공유 — 콘텐츠를 다 본 뒤 공유하는 흐름이라 하단 배치 */}
      <div className="mt-8 flex justify-center">
        <ShareCardButton
          url={`/api/card/user/${encodeURIComponent(basic.nickname)}`}
          filename={`fcscope-${basic.nickname}.png`}
          label="전적 카드 저장 · 공유"
        />
      </div>
    </div>
  );
}

const MATCH_COUNT = 30;

async function MatchSection({
  ouid,
  matchType,
  nickname,
}: {
  ouid: string;
  matchType: number;
  nickname: string;
}) {
  // 히어로 배지(공식경기)와 같은 요청이면 React cache()로 넥슨 호출 공유
  const { listOk, matchIds, details } = await getRecentMatchDetails(
    ouid,
    matchType,
    MATCH_COUNT
  );
  const summaries: MatchSummary[] = [];
  for (const d of details) {
    const s = summarizeMatch(d, ouid);
    if (s) summaries.push(s);
  }

  if (summaries.length === 0) {
    return (
      <div className="panel mt-4 px-6 py-14 text-center text-sm text-muted">
        {listOk
          ? "최근 경기 기록이 없습니다."
          : "넥슨 조회가 일시적으로 원활하지 않아 경기 목록을 불러오지 못했어요. 잠시 후 새로고침해 주세요."}
      </div>
    );
  }

  const rec = aggregate(summaries);
  const recent10 = summaries.slice(0, 10);
  const rivals = topRivals(summaries);
  // 본인 방문 스냅샷 기록용 평균 평점 (0 제외)
  const ratings = summaries.map((m) => m.me.rating).filter((r) => r > 0);
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 0;
  // 부분 실패 투명화 — 일부 경기를 못 불러왔으면 "조용히 틀린 숫자" 대신 기준을 명시
  const missing = matchIds.length - details.length;

  return (
    <>
      {/* 본인 방문 시 하루 1스냅샷 기록 (지난 방문 대비 delta 재료) */}
      <VisitRecorder
        nickname={nickname}
        winRate={rec.winRate}
        avgRating={avgRating}
        played={rec.played}
      />
      {missing > 0 && (
        <p className="mt-4 rounded-lg bg-gold/10 px-3 py-2 text-sm text-muted">
          ⚠️ 최근 {matchIds.length}경기 중 {details.length}경기만 불러와{" "}
          <b className="text-ink">{details.length}경기 기준</b>으로 계산했어요.
          잠시 후 새로고침하면 나머지도 반영됩니다.
        </p>
      )}
      {/* 폼 전광판 */}
      <section className="panel mt-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="text-[13px] font-medium text-muted">최근 {rec.played}경기 승률</p>
            <p className="scoreboard text-4xl font-bold text-accent">{rec.winRate}%</p>
            <p className="scoreboard mt-0.5 text-xs font-semibold text-muted">
              {rec.win}승 {rec.draw}무 {rec.lose}패
            </p>
          </div>
          <div>
            <p className="text-[13px] font-medium text-muted">최근 10경기 폼</p>
            <div className="mt-1.5 flex gap-1">
              {recent10.map((m) => (
                <span
                  key={m.matchId}
                  title={`${m.result} ${m.me.goals}:${m.opponent?.goals ?? "-"}`}
                  className={`scoreboard flex h-6 w-6 items-center justify-center rounded text-[13px] font-bold ${
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
            <p className="text-[13px] font-medium text-muted">경기 평점 흐름</p>
            <RatingSparkline values={[...summaries].reverse().map((m) => m.me.rating)} />
          </div>
        </div>
      </section>

      {/* 스탯 타일 */}
      <section className="mt-2 grid grid-cols-3 gap-2">
        <div className="panel px-3 py-2.5">
          <p className="text-[13px] font-medium text-muted">득점 / 실점</p>
          <p className="scoreboard mt-0.5 text-lg font-bold">
            <span className="text-win">{rec.goalsFor}</span>
            <span className="mx-1 text-sm font-normal text-muted">/</span>
            <span className="text-lose">{rec.goalsAgainst}</span>
          </p>
          {rec.goalsFor + rec.goalsAgainst > 0 && (
            <div
              className="mt-1.5 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={`득점 ${rec.goalsFor}, 실점 ${rec.goalsAgainst}`}
            >
              <div
                className="rounded-full bg-win"
                style={{ flexGrow: rec.goalsFor }}
              />
              <div
                className="rounded-full bg-lose"
                style={{ flexGrow: rec.goalsAgainst }}
              />
            </div>
          )}
        </div>
        <StatTile label="경기당 득점" value={(rec.goalsFor / rec.played).toFixed(1)} />
        <StatTile label="평균 점유율" value={`${rec.avgPossession}%`} />
      </section>

      {/* 경기 성향 진단 — 사전 셋팅 룰 100+개 중 매칭 (현재 탭 표본 기준) */}
      <PerfDiagnosisPanel summaries={summaries} />

      {/* 라이벌 — 자주 만난 상대 H2H */}
      {rivals.length > 0 && <RivalsPanel rivals={rivals} />}

      {/* 경기 리스트 — 카드 개봉처럼 순차 리빌 */}
      <ul className="mt-4 space-y-1.5">
        {summaries.map((m, i) => (
          <li
            key={m.matchId}
            className="pop-in"
            style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
          >
            <MatchRow m={m} ouid={ouid} />
          </li>
        ))}
      </ul>
    </>
  );
}

function PerfDiagnosisPanel({ summaries }: { summaries: MatchSummary[] }) {
  const diag = diagnoseMatchPerf(computeMatchPerfStats(summaries));
  if (!diag.type) return null;
  return (
    <section className="panel mt-2 p-4">
      <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
        경기 성향 진단
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`scoreboard rounded-lg px-3 py-1.5 text-sm font-bold ${TONE_BG[diag.type.tone]} ${TONE_TEXT[diag.type.tone]}`}
        >
          ⚽ {diag.type.title}
        </span>
        <p className="text-sm text-muted">{diag.type.desc}</p>
      </div>
      {diag.notes.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {diag.notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full ${TONE_DOT[n.tone]}`}
                aria-hidden
              />
              <span>
                <b className={TONE_TEXT[n.tone]}>{n.title}</b>
                <span className="ml-1.5 text-muted">{n.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-muted">
        불러온 최근 경기 기준 룰베이스 진단 · 표본이 쌓일수록 정확해집니다
      </p>
    </section>
  );
}

function RivalsPanel({ rivals }: { rivals: Rival[] }) {
  return (
    <section className="panel mt-2 p-4">
      <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
        자주 만난 상대 (라이벌)
      </p>
      <ul className="mt-2 space-y-1.5">
        {rivals.map((r) => {
          const edge =
            r.win > r.lose ? "text-win" : r.win < r.lose ? "text-lose" : "text-muted";
          return (
            <li key={r.nickname}>
              <Link
                href={`/user/${encodeURIComponent(r.nickname)}`}
                className="block rounded-lg bg-surface-2 px-3 py-2 transition-colors hover:bg-line"
              >
                <span className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {r.nickname}
                  </span>
                  <span className={`scoreboard text-sm font-bold ${edge}`}>
                    {r.win}승 {r.draw}무 {r.lose}패
                  </span>
                  <span className="scoreboard flex-none text-[13px] text-muted">
                    {r.goalsFor}:{r.goalsAgainst}
                  </span>
                  <span className="scoreboard flex-none text-xs text-accent">전적 →</span>
                </span>
                {/* 승(왼)/무/패(오) 비율 바 — 순서로도 구분 */}
                <span className="mt-1.5 flex h-1 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                  {r.win > 0 && <span className="rounded-full bg-win" style={{ flexGrow: r.win }} />}
                  {r.draw > 0 && <span className="rounded-full bg-draw" style={{ flexGrow: r.draw }} />}
                  {r.lose > 0 && <span className="rounded-full bg-lose" style={{ flexGrow: r.lose }} />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-muted">
        최근 불러온 경기 기준 · 2회 이상 만난 상대만 · 탭하면 그 구단주 전적으로 이동
      </p>
    </section>
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
      <p className="text-[13px] font-medium text-muted">{label}</p>
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
        <p className="mt-0.5 text-sm text-muted">
          {formatMatchDate(m.matchDate)}
          {m.forfeit && <span className="ml-1.5 text-lose">몰수</span>}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-[13px] text-muted">평점</p>
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
  const notFound = isUserNotFound(err);
  const isDev = process.env.NODE_ENV !== "production";

  let title = "일시적으로 조회할 수 없어요";
  let desc = "잠시 후 다시 시도해 주세요.";
  let retry = true; // 일시 오류/점검 → 같은 주소 재시도가 1순위 CTA

  if (notFound) {
    title = `‘${nickname}’ 구단주를 찾을 수 없어요`;
    desc =
      "닉네임 철자를 확인해 주세요. 최근에 닉네임을 바꿨다면 넥슨 반영까지 시간이 걸릴 수 있어요.";
    retry = false;
  } else if (isNotConfigured(err)) {
    title = "잠시 정비 중이에요";
    desc = isDev
      ? "넥슨 API 연동 설정이 완료되지 않았습니다. (NEXON_API_KEY 미설정)"
      : "일시적으로 전적을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.";
  } else if (isMaintenance(err)) {
    title = "게임 점검 중이에요";
    desc = "점검이 끝나면 다시 조회할 수 있어요.";
  } else if (isPaused(err)) {
    title = "전적 조회를 잠시 멈췄어요";
    desc =
      "넥슨 API 상황에 따라 운영자가 조회를 일시적으로 중단했어요. 곧 다시 열립니다.";
    retry = false;
  } else if (isRateLimited(err)) {
    // 429: 재시도 연타가 상황을 악화시키므로 '다시 시도' 버튼을 숨긴다.
    title = "지금 조회 요청이 많아요";
    desc =
      "넥슨 조회 한도로 잠시 제한되고 있어요. 1~2분 후에 다시 검색해 주세요. (새로고침 연타는 오히려 느려져요)";
    retry = false;
  } else if (isTimeout(err)) {
    title = "응답이 조금 느려요";
    desc =
      "넥슨 서버 응답이 지연되고 있어요. 잠시 후 다시 시도하면 대부분 정상적으로 조회됩니다.";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
      {notFound && (
        <p
          aria-hidden
          className="scoreboard text-5xl font-bold"
          style={{ color: "color-mix(in srgb, var(--ink) 12%, transparent)" }}
        >
          4:04
        </p>
      )}
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{desc}</p>

      {notFound ? (
        // 오타 회복: 닉네임 프리필 재검색 (재입력 마찰 제거)
        <div className="mt-8 w-full max-w-md">
          <SearchForm size="lg" defaultValue={nickname} />
          {DEMO_NICKNAME && (
            <Link
              href={`/user/${encodeURIComponent(DEMO_NICKNAME)}`}
              className="mt-3 inline-block text-sm text-muted underline underline-offset-2"
            >
              또는 예시 리포트 구경하기 →
            </Link>
          )}
        </div>
      ) : retry ? (
        <a
          href={`/user/${encodeURIComponent(nickname)}`}
          className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
        >
          다시 시도
        </a>
      ) : null}

      <Link
        href="/"
        className="mt-4 text-sm text-muted underline underline-offset-2"
      >
        홈에서 다시 검색
      </Link>
    </div>
  );
}
