import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { limitNexonFanout } from "@/lib/security/rate-limit";
import SearchForm from "@/app/components/SearchForm";
import { DEMO_NICKNAME } from "@/lib/demo";
import { getMaxDivisions, getOuid, getUserBasic } from "@/lib/nexon/api";
import { isMaintenance, isNotConfigured, isPaused, isRateLimited, isTimeout, isUserNotFound } from "@/lib/nexon/client";
import { MATCH_TABS, getDivisionName, getMatchTypeName } from "@/lib/nexon/meta";
import { aggregate, summarizeMatch, topRivals, pickNemesis, type MatchSummary, type Rival } from "@/lib/nexon/summary";
import { matchScore, recentScore, scoreTier } from "@/lib/nexon/score";
import { formatAchievementDate, formatMatchDate } from "@/lib/format";
import SquadSection from "./SquadSection";
import PlaystyleSection from "./PlaystyleSection";
import ReportSection from "./ReportSection";
import VisitRecorder from "./VisitRecorder";
import HeroBadges from "./HeroBadges";
import DivisionIcon from "@/app/components/DivisionIcon";
import { divisionIconUrl } from "@/lib/nexon/division-icon";
import ShareCardButton from "@/app/components/ShareCardButton";
import RefreshButton from "@/app/components/RefreshButton";
import FavoriteButton from "@/app/components/FavoriteButton";
import { getRecentMatchDetails } from "@/lib/nexon/recent";
import { computeMatchPerfStats, diagnoseMatchPerf } from "@/lib/match/diagnosis";
import { streakLabel, hasStreakHighlight } from "@/lib/nexon/streak-card";
import { weeklyRecap } from "@/lib/nexon/weekly";
import { logNicknameSearch } from "@/lib/search-log";
import { SITE_URL } from "@/lib/site";
import { TONE_BG, TONE_DOT, TONE_TEXT } from "@/lib/diagnosis/tone";

export const maxDuration = 60; // 콜드 조회: 매치 상세 최대 30건 순차 호출 대비

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nickname: string }>;
}): Promise<Metadata> {
  const { nickname } = await params;
  // 잘못된 % 시퀀스도 throw 없이 통과 (외부/레거시 링크 방어)
  let decoded: string;
  try {
    decoded = decodeURIComponent(nickname);
  } catch {
    decoded = nickname;
  }
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
  // 잘못된 % 시퀀스는 raw 그대로 사용 → getOuid가 not-found로 자연 처리(크래시 방지)
  let nickname: string;
  try {
    nickname = decodeURIComponent(raw);
  } catch {
    nickname = raw;
  }
  // 이적시장은 매치 종류와 무관 → 독립 페이지로 이동 (기존 링크 호환)
  if (view === "market") redirect(`/market/${encodeURIComponent(nickname)}`);

  // 넥슨 팬아웃(매치 30건 + 배지 + 등급)을 유발하는 SSR — IP rate limit 선차단
  const hdrs = await headers();
  const rl = limitNexonFanout(hdrs, "user-page");
  if (!rl.ok) return <TooManyRequests nickname={nickname} />;
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
  let divisions: Awaited<ReturnType<typeof getMaxDivisions>> = [];
  try {
    ouid = await getOuid(nickname);
    // basic·등급은 둘 다 ouid만 필요 → 병렬로 받아 직렬 왕복 1회 절감(콜드 조회 체감속도↑).
    // 여기서 보호하지 않으면 429/점검/타임아웃이 맞춤 ErrorState 대신 generic error로 추락.
    const [b, d] = await Promise.all([
      getUserBasic(ouid),
      getMaxDivisions(ouid).catch(() => []),
    ]);
    basic = b;
    divisions = d;
  } catch (err) {
    return <ErrorState err={err} nickname={nickname} />;
  }

  // 검색된 구단주 기록 → sitemap 색인 시드 (best-effort, 렌더 안 막음).
  // 봇 UA는 제외 → 크롤러 재크롤이 유발하던 불필요한 쓰기 IO 제거.
  logNicknameSearch(basic.nickname, hdrs.get("user-agent"));

  const divisionCards = await Promise.all(
    divisions.slice(0, 3).map(async (d) => ({
      matchTypeName: await getMatchTypeName(d.matchType),
      divisionName: await getDivisionName(d.division),
      date: formatAchievementDate(d.achievementDate),
      iconUrl: divisionIconUrl(d.division),
    }))
  );

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${basic.nickname} 전적`,
    url: `${SITE_URL}/user/${encodeURIComponent(basic.nickname)}`,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: `${basic.nickname} 전적` },
      ],
    },
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }}
      />
      {/* 히어로 — 전광판 */}
      <section className="panel rise relative overflow-hidden px-5 py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(200,245,66,0.14), transparent)" }}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold sm:text-4xl">{basic.nickname}</h1>
            <p className="scoreboard text-sm font-semibold text-muted">
              LV.<span className="text-accent">{basic.level}</span>
            </p>
            {/* 즐겨찾기 + 전적 갱신 — 재방문 훅 + op.gg 시그니처 */}
            <div className="ml-auto flex items-center gap-2">
              <FavoriteButton nickname={basic.nickname} />
              <RefreshButton nickname={basic.nickname} />
            </div>
          </div>
          {divisionCards.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {divisionCards.map((d) => (
                <p
                  key={d.matchTypeName}
                  className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-muted"
                >
                  <span className="whitespace-nowrap">{d.matchTypeName}</span>
                  {/* 등급 아이콘은 등급명 바로 왼쪽 (인게임 표기와 동일) */}
                  {d.iconUrl && <DivisionIcon src={d.iconUrl} size={20} />}
                  <span className="whitespace-nowrap font-bold text-gold">
                    {d.divisionName}
                  </span>
                  {/* 달성일은 모바일에서 숨겨 공간 확보 */}
                  <span className="hidden whitespace-nowrap sm:inline">({d.date})</span>
                </p>
              ))}
            </div>
          )}
          {/* 계급 인증 카드 — 등급 바로 아래에 배치해 '숨긴 자산' 방지 (기존엔 페이지 최하단) */}
          {divisionCards.length > 0 && (
            <div className="mt-3">
              <ShareCardButton
                url={`/api/card/rank/${encodeURIComponent(basic.nickname)}`}
                filename={`fcscope-rank-${basic.nickname}.png`}
                label="🏆 계급 인증 카드"
              />
            </div>
          )}
        </div>
      </section>

      {/* 성향 배지 — 공식경기·이적시장 유형 + "왜 그런지" 설명 (스트리밍) */}
      <Suspense
        fallback={
          <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-hidden>
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        }
      >
        <HeroBadges ouid={ouid} nickname={basic.nickname} />
      </Suspense>

      {/* 매치 종류 탭 + 이적시장 진입 — 모바일에서도 한 줄 유지(넘치면 가로 스크롤) */}
      <nav className="scrollbar-hide rise rise-1 mt-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        {MATCH_TABS.map((t) => (
          <Link
            key={t.type}
            href={`/user/${encodeURIComponent(basic.nickname)}?type=${t.type}${
              activeView === "matches" ? "" : `&view=${activeView}`
            }`}
            className={`scoreboard inline-flex min-h-11 flex-none items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors sm:px-3.5 sm:text-sm ${
              t.type === matchType
                ? "bg-accent text-accent-ink"
                : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
        {/* 이적시장 — ml-auto 제거: 좁은 화면에서 스크롤 컨테이너 밖으로 밀려 잘리던 문제 해소 */}
        <Link
          href={`/market/${encodeURIComponent(basic.nickname)}`}
          className="scoreboard flex-none whitespace-nowrap rounded-lg bg-gold/15 px-2.5 py-1.5 text-[13px] font-bold text-gold transition-colors hover:bg-gold/25 sm:px-3.5 sm:text-sm"
        >
          💰 이적시장
        </Link>
      </nav>

      {/* 뷰 서브탭 */}
      <nav className="scrollbar-hide rise rise-2 mt-2 flex gap-4 overflow-x-auto border-b border-line/70">
        {(
          [
            { view: "matches", label: "경기 기록" },
            { view: "report", label: "종합 리포트" },
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
              className={`-mb-px inline-flex min-h-11 flex-none items-center whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-semibold transition-colors ${
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
          <SquadSection ouid={ouid} matchType={matchType} nickname={basic.nickname} />
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

      {/* 전적 카드 저장·공유 — 콘텐츠를 다 본 뒤 공유하는 흐름이라 하단 배치 (계급 카드는 히어로로 승격) */}
      <div className="mt-6 flex justify-center">
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

// FC Scope 스코어 등급 색 토큰
const TIER_TEXT: Record<"gold" | "win" | "muted" | "lose", string> = {
  gold: "text-gold",
  win: "text-win",
  muted: "text-ink",
  lose: "text-lose",
};

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
      <div className="panel mt-4 px-6 py-10 text-center text-sm text-muted">
        {listOk
          ? "최근 경기 기록이 없습니다."
          : "넥슨 조회가 일시적으로 원활하지 않아 경기 목록을 불러오지 못했어요. 잠시 후 새로고침해 주세요."}
      </div>
    );
  }

  const rec = aggregate(summaries);
  const recent10 = summaries.slice(0, 10);
  const rivals = topRivals(summaries);
  // 천적 — 매 방문 최근 경기로 재계산되는 살아있는 H2H(복수전 재방문 훅). 있을 때만 배너.
  const nemesis = pickNemesis(rivals);
  // 이번 주 성적표 — 매주 돌아올 정기 결산 훅(추가 조회 0, 최근 7일 윈도잉).
  const week = weeklyRecap(summaries);
  // FC Scope 스코어 — 최근 경기 퍼포먼스 대표 점수 (정체성·매세션 재확인 훅)
  const score = recentScore(summaries);
  const tier = scoreTier(score);
  // 연승/폼 하이라이트 — 살아있고 소멸하는 값(재방문·자랑 훅). 사건이 있을 때만 배너.
  const perf = computeMatchPerfStats(summaries);
  const streak = streakLabel(perf);
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
      {/* 이번 주 성적표 — 매주 돌아올 정기 결산(주 3경기 이상일 때만). 공유 카드로 자랑 */}
      {week.games >= 3 && <WeeklyRecapBanner week={week} nickname={nickname} />}

      {/* 연승/폼 하이라이트 배너 — 사건 있을 때만(죽은 배너 방지). 카드로 자랑 → 유입 */}
      {hasStreakHighlight(perf) && (
        <section
          className={`panel mt-4 flex items-center gap-3 px-4 py-3 ${
            streak.color === "lose" ? "border-lose/40" : "border-win/40"
          }`}
        >
          {/* 이모지·부제는 streak.color(라벨과 동일 소스)로 판단 — currentStreak만 보면
              momentum 하락(연승 (-2,2)) 케이스에서 "폼 하락 중"+🔥+"상승 중" 모순이 났음 */}
          <span className="flex-none text-2xl" aria-hidden>
            {streak.color === "lose" ? "🥶" : "🔥"}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`scoreboard text-lg font-bold ${
                streak.color === "gold"
                  ? "text-gold"
                  : streak.color === "lose"
                    ? "text-lose"
                    : "text-win"
              }`}
            >
              {streak.text}
            </p>
            <p className="text-[13px] text-muted">
              {streak.color === "lose"
                ? "반등을 노려보자"
                : perf.currentStreak >= 2
                  ? "이 기세 이어가자 — 폼 카드로 자랑하기"
                  : "폼이 올라오는 중"}
            </p>
          </div>
          <div className="flex-none">
            <ShareCardButton
              url={`/api/card/streak/${encodeURIComponent(nickname)}`}
              filename={`fcscope-streak-${nickname}.png`}
              label="🔥 폼 카드"
            />
          </div>
        </section>
      )}

      {/* 천적 복수전 배너 — 폴드 아래 묻혀 있던 nemesis를 상단 이벤트로 승격 (재방문·저격 훅) */}
      {nemesis && <RevengeBanner rival={nemesis} nickname={nickname} />}

      {/* 폼 전광판 */}
      <section className="panel mt-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          {/* FC Scope 스코어 — 대표 퍼포먼스 점수 (op.gg OP Score 대응) */}
          <div>
            <p className="text-[13px] font-medium text-muted">FC Scope 스코어</p>
            <p className={`scoreboard text-4xl font-bold ${TIER_TEXT[tier.tone]}`}>
              {score.toFixed(1)}
              <span className="ml-0.5 text-lg font-semibold text-muted">/10</span>
            </p>
            <p className={`scoreboard mt-0.5 text-xs font-bold ${TIER_TEXT[tier.tone]}`}>
              {tier.label}
            </p>
          </div>
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
        {/* FC Scope 스코어 설명 — 브랜드 대표 숫자의 의미를 한 줄로 (op.gg OP Score식) */}
        <p className="mt-3 border-t border-line/60 pt-2.5 text-[12px] leading-relaxed text-muted">
          <b className="text-ink">FC Scope 스코어</b>는 최근 경기의 승패·득실차·인게임 평점·점유율을
          종합한 <b className="text-ink">퍼포먼스 점수(10점 만점)</b>예요. 이기기만 한 게 아니라
          경기 내용까지 반영합니다.
        </p>
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
      {rivals.length > 0 && <RivalsPanel rivals={rivals} nickname={nickname} />}

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

/** 이번 주 성적표 배너 — 최근 7일 W-L-D·평균 스코어 요약 + 주간 카드 공유(정기 재방문 훅). */
function WeeklyRecapBanner({
  week,
  nickname,
}: {
  week: import("@/lib/nexon/weekly").WeeklyRecap;
  nickname: string;
}) {
  const good = week.winRate >= 50;
  return (
    <section className="panel mt-4 flex items-center gap-3 border-accent/30 px-4 py-3">
      <span className="flex-none text-2xl" aria-hidden>📅</span>
      <div className="min-w-0 flex-1">
        <p className="scoreboard text-[12px] font-bold tracking-[0.2em] text-muted">
          이번 주 성적표 · 최근 7일 {week.games}경기
        </p>
        <p className="mt-0.5 text-lg font-bold">
          <span className={good ? "text-win" : "text-lose"}>
            {week.win}승 {week.draw}무 {week.lose}패
          </span>
          <span className="ml-2 text-sm font-semibold text-muted">
            승률 {week.winRate}% · 평균 <span className="text-gold">{week.avgScore.toFixed(1)}</span>
            {week.bestStreak >= 2 && <span className="ml-1 text-win">· 🔥{week.bestStreak}연승</span>}
          </span>
        </p>
      </div>
      <div className="flex-none">
        <ShareCardButton
          url={`/api/card/weekly/${encodeURIComponent(nickname)}`}
          filename={`fcscope-weekly-${nickname}.png`}
          label="📅 주간 카드"
        />
      </div>
    </section>
  );
}

/** 천적 복수전 배너 — "당신의 천적 OOO, 아직 N점 뒤" + 저격 공유 카드(?vs=). */
function RevengeBanner({ rival, nickname }: { rival: Rival; nickname: string }) {
  const gap = rival.lose - rival.win; // 뒤진 점수
  return (
    <section className="panel mt-4 flex items-center gap-3 border-lose/40 px-4 py-3">
      <span className="flex-none text-2xl" aria-hidden>🎯</span>
      <div className="min-w-0 flex-1">
        <p className="scoreboard text-lg font-bold text-lose">
          천적 {rival.nickname}
        </p>
        <p className="text-[13px] text-muted">
          {rival.win}승 {rival.lose}패 · 아직 <b className="text-ink">{gap}점</b> 뒤 — 복수하러 가자
        </p>
      </div>
      <div className="flex-none">
        <ShareCardButton
          url={`/api/card/rival/${encodeURIComponent(nickname)}?vs=${encodeURIComponent(rival.nickname)}`}
          filename={`fcscope-rival-${nickname}.png`}
          label="🎯 복수전 카드"
        />
      </div>
    </section>
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

function RivalsPanel({ rivals, nickname }: { rivals: Rival[]; nickname: string }) {
  return (
    <section className="panel mt-2 p-4">
      <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
        자주 만난 상대 (라이벌)
      </p>
      <ul className="mt-2 space-y-1.5">
        {rivals.map((r) => {
          const edge =
            r.win > r.lose ? "text-win" : r.win < r.lose ? "text-lose" : "text-muted";
          // 천적/호구 — 이미 있는 승패 집계 재사용. 3경기 이상 + 2경기차 이상일 때만 라벨.
          const diff = r.win - r.lose;
          const nemesis = r.games >= 3 && diff <= -2;
          const prey = r.games >= 3 && diff >= 2;
          return (
            <li key={r.nickname}>
              <Link
                href={`/user/${encodeURIComponent(r.nickname)}`}
                className="block rounded-lg bg-surface-2 px-3 py-2 transition-colors hover:bg-line"
              >
                <span className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="min-w-0 truncate text-sm font-semibold">
                      {r.nickname}
                    </span>
                    {nemesis && (
                      <span className="scoreboard flex-none rounded bg-lose/15 px-1.5 py-0.5 text-[11px] font-bold text-lose">
                        천적
                      </span>
                    )}
                    {prey && (
                      <span className="scoreboard flex-none rounded bg-win/15 px-1.5 py-0.5 text-[11px] font-bold text-win">
                        호구
                      </span>
                    )}
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
      {/* 라이벌 카드 공유 — 천적/호구 서사로 지목·저격 → 지목당한 사람이 검색 유입(바이럴 훅) */}
      <div className="mt-3">
        <ShareCardButton
          url={`/api/card/rival/${encodeURIComponent(nickname)}`}
          filename={`fcscope-rival-${nickname}.png`}
          label="⚔️ 라이벌 카드 저장 · 공유"
        />
      </div>
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
  const sc = matchScore(m);
  const scTier = scoreTier(sc);

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

      {/* FC Scope 스코어 — 경기별 대표 점수 (모바일에서도 노출) */}
      <div className="flex-none text-right">
        <p className="text-[13px] text-muted">스코어</p>
        <p className={`scoreboard text-sm font-bold ${TIER_TEXT[scTier.tone]}`}>
          {sc.toFixed(1)}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-[13px] text-muted">평점</p>
        <p className="scoreboard text-sm font-semibold">
          {m.me.rating > 0 ? m.me.rating.toFixed(1) : "-"}
        </p>
      </div>

      <span className="scoreboard hidden text-xs font-bold text-muted transition-colors group-hover:text-accent sm:inline">
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

function TooManyRequests({ nickname }: { nickname: string }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 text-center">
      <h1 className="text-xl font-bold">지금 조회 요청이 많아요</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        같은 네트워크에서 요청이 몰리고 있어요. 1~2분 후에 다시 검색해 주세요.
        (새로고침 연타는 오히려 느려져요)
      </p>
      <Link
        href={`/user/${encodeURIComponent(nickname)}`}
        className="mt-6 text-sm text-muted underline underline-offset-2"
      >
        잠시 후 다시 시도
      </Link>
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
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 text-center">
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
          {/* 선수명 의도로 막다른 길에 온 경우 — 선수 도감으로 넘겨 발견성 회복
              (구단주 검색이 "손흥민" 같은 선수명이면 여기로 오게 됨) */}
          <Link
            href={`/meta?q=${encodeURIComponent(nickname)}`}
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent underline underline-offset-2"
          >
            혹시 선수를 찾으세요? ‘{nickname}’ 선수 도감에서 검색 →
          </Link>
          {DEMO_NICKNAME && (
            <Link
              href={`/user/${encodeURIComponent(DEMO_NICKNAME)}`}
              className="mt-2 inline-block text-sm text-muted underline underline-offset-2"
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
