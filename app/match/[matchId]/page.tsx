import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ShotMap, { detectGoalCode, type ShotMapShot } from "@/app/components/ShotMap";
import VerdictStamp from "@/app/components/VerdictStamp";
import { verdictFromMatch } from "@/lib/verdict";
import { formatMatchDate } from "@/lib/format";
import { NexonApiError, isNotConfigured } from "@/lib/nexon/client";
import { getMatchDetailCached } from "@/lib/nexon/cached";
import { getMatchTypeName, getPositionLabel } from "@/lib/nexon/meta";
import { getPlayerNames } from "@/lib/nexon/players";
import type { MatchInfoEntry } from "@/lib/nexon/types";

export const metadata: Metadata = { title: "매치 리포트" };

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ me?: string }>;
}) {
  const [{ matchId }, { me }] = await Promise.all([params, searchParams]);

  let detail;
  try {
    detail = await getMatchDetailCached(matchId);
  } catch (err) {
    return <MatchError err={err} />;
  }

  const info = detail.matchInfo ?? [];
  if (info.length === 0) return <MatchError err={null} />;

  const mine = info.find((e) => e.ouid === me) ?? info[0];
  const opp = info.find((e) => e !== mine) ?? null;
  const matchTypeName = await getMatchTypeName(detail.matchType);

  // 골 코드 자동 판별 (result 코드 스펙 불확실 → 총득점 대조)
  const goalCode = detectGoalCode(
    [mine, ...(opp ? [opp] : [])].map((e) => ({
      shots: e.shootDetail ?? [],
      goals: e.shoot?.goalTotalDisplay ?? e.shoot?.goalTotal ?? 0,
    }))
  );

  // 선수 이름 일괄 로드 (양측 출전 + 슛 이벤트)
  const spIds = new Set<number>();
  for (const e of info) {
    for (const p of e.player ?? []) spIds.add(p.spId);
    for (const s of e.shootDetail ?? []) spIds.add(s.spId);
  }
  const names = await getPlayerNames([...spIds]);

  const toShots = (e: MatchInfoEntry): ShotMapShot[] =>
    (e.shootDetail ?? []).map((s) => ({
      x: s.x,
      y: s.y,
      isGoal: goalCode !== null && s.result === goalCode,
      hitPost: s.hitPost,
      label: `${Math.round(s.goalTime / 60) || "?"}' ${names.get(s.spId) ?? s.spId} — ${
        goalCode !== null && s.result === goalCode
          ? "골"
          : s.hitPost
            ? "골대"
            : "노골"
      }`,
    }));

  // POTM: 양측 통틀어 최고 평점
  const rated = info.flatMap((e) =>
    (e.player ?? [])
      .filter((p) => (p.status?.spRating ?? 0) > 0)
      .map((p) => ({ p, side: e.nickname }))
  );
  const potm = rated.sort(
    (a, b) => (b.p.status?.spRating ?? 0) - (a.p.status?.spRating ?? 0)
  )[0];

  const myGoals = mine.shoot?.goalTotalDisplay ?? mine.shoot?.goalTotal ?? 0;
  const oppGoals = opp ? (opp.shoot?.goalTotalDisplay ?? opp.shoot?.goalTotal ?? 0) : null;
  const myPoss = mine.matchDetail?.possession ?? 50;

  const matchVerdict = verdictFromMatch({
    result: mine.matchDetail?.matchResult ?? "?",
    myRating: mine.matchDetail?.averageRating ?? 0,
    seed: detail.matchId,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <p className="scoreboard rise text-xs font-semibold tracking-[0.25em] text-muted">
        {matchTypeName.toUpperCase()} · {formatMatchDate(detail.matchDate)}
      </p>

      {/* 스코어보드 */}
      <section className="panel rise rise-1 mt-3 px-5 py-6 text-center">
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          <TeamName entry={mine} me />
          <p className="scoreboard text-4xl font-bold sm:text-5xl">
            {myGoals}
            <span className="mx-2 text-xl text-muted sm:mx-3">:</span>
            <span className="text-muted">{oppGoals ?? "-"}</span>
          </p>
          {opp ? <TeamName entry={opp} /> : <span className="flex-1" />}
        </div>
        {mine.matchDetail?.matchEndType !== 0 && (
          <p className="mt-2 text-xs text-lose">몰수 경기</p>
        )}

        {/* 심판 도장 — 실유저 대상이라 중립 톤(otherUser) */}
        <div className="mt-3 flex justify-center">
          <VerdictStamp verdict={matchVerdict} size="lg" showLiner />
        </div>

        {/* 점유율 바 */}
        <div className="mx-auto mt-5 max-w-sm">
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="bg-accent" style={{ width: `${myPoss}%` }} />
            <div className="bg-lose/70" style={{ width: `${100 - myPoss}%` }} />
          </div>
          <div className="scoreboard mt-1 flex justify-between text-[11px] font-semibold text-muted">
            <span className="text-accent">{myPoss}%</span>
            <span>점유율</span>
            <span className="text-lose">{100 - myPoss}%</span>
          </div>
        </div>
      </section>

      {/* 슛맵 */}
      <section className="rise rise-2 mt-6">
        <h2 className="scoreboard text-xs font-semibold tracking-[0.25em] text-muted">
          SHOT MAP
        </h2>
        <div className={`mt-3 grid gap-3 ${opp ? "sm:grid-cols-2" : ""}`}>
          <div>
            <p className="mb-1.5 text-xs font-medium">
              <span className="text-accent">●</span> {mine.nickname} — 슛{" "}
              {mine.shoot?.shootTotal ?? 0} (유효 {mine.shoot?.effectiveShootTotal ?? 0})
            </p>
            <ShotMap shots={toShots(mine)} tone="lime" />
          </div>
          {opp && (
            <div>
              <p className="mb-1.5 text-xs font-medium">
                <span className="text-lose">●</span> {opp.nickname} — 슛{" "}
                {opp.shoot?.shootTotal ?? 0} (유효 {opp.shoot?.effectiveShootTotal ?? 0})
              </p>
              <ShotMap shots={toShots(opp)} tone="rose" />
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          ● 채움=골 · ○ 외곽선=노골 · <span className="text-gold">○ 금색=골대</span>
        </p>
      </section>

      {/* POTM */}
      {potm && (
        <section className="panel rise rise-3 mt-6 flex items-center gap-4 p-4">
          <Image
            src={`/api/player-image/${potm.p.spId}`}
            alt=""
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 flex-none rounded-xl bg-surface-2 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="scoreboard text-[10px] font-bold tracking-[0.2em] text-gold">
              PLAYER OF THE MATCH
            </p>
            <p className="mt-0.5 truncate font-bold">
              {names.get(potm.p.spId) ?? potm.p.spId}
              <span className="ml-2 text-xs font-medium text-muted">
                {getPositionLabel(potm.p.spPosition)} · {potm.side}
              </span>
            </p>
          </div>
          <p className="scoreboard text-3xl font-bold text-gold">
            {(potm.p.status?.spRating ?? 0).toFixed(1)}
          </p>
        </section>
      )}

      {/* 팀 스탯 비교 */}
      {opp && (
        <section className="rise rise-3 mt-6">
          <h2 className="scoreboard text-xs font-semibold tracking-[0.25em] text-muted">
            TEAM STATS
          </h2>
          <div className="panel mt-3 divide-y divide-line/60 px-4">
            <StatCompare label="슛 (유효)" a={`${mine.shoot?.shootTotal ?? 0} (${mine.shoot?.effectiveShootTotal ?? 0})`} b={`${opp.shoot?.shootTotal ?? 0} (${opp.shoot?.effectiveShootTotal ?? 0})`} />
            <StatCompare label="패스 성공률" a={passRate(mine)} b={passRate(opp)} />
            <StatCompare label="드리블" a={`${mine.matchDetail?.dribble ?? 0}`} b={`${opp.matchDetail?.dribble ?? 0}`} />
            <StatCompare label="태클 성공" a={`${mine.defence?.tackleSuccess ?? 0}/${mine.defence?.tackleTry ?? 0}`} b={`${opp.defence?.tackleSuccess ?? 0}/${opp.defence?.tackleTry ?? 0}`} />
            <StatCompare label="코너킥" a={`${mine.matchDetail?.cornerKick ?? 0}`} b={`${opp.matchDetail?.cornerKick ?? 0}`} />
            <StatCompare label="파울 (경고)" a={`${mine.matchDetail?.foul ?? 0} (${mine.matchDetail?.yellowCards ?? 0})`} b={`${opp.matchDetail?.foul ?? 0} (${opp.matchDetail?.yellowCards ?? 0})`} />
          </div>
        </section>
      )}

      {/* 선수 평점 */}
      <section className="rise rise-4 mt-6">
        <h2 className="scoreboard text-xs font-semibold tracking-[0.25em] text-muted">
          RATINGS
        </h2>
        <div className={`mt-3 grid gap-3 ${opp ? "sm:grid-cols-2" : ""}`}>
          <RatingList entry={mine} names={names} />
          {opp && <RatingList entry={opp} names={names} />}
        </div>
      </section>

      <div className="mt-8">
        <Link
          href={`/user/${encodeURIComponent(mine.nickname)}`}
          className="text-sm text-muted transition-colors hover:text-accent"
        >
          ← {mine.nickname} 전적으로
        </Link>
      </div>
    </div>
  );
}

function TeamName({ entry, me = false }: { entry: MatchInfoEntry; me?: boolean }) {
  return (
    <Link
      href={`/user/${encodeURIComponent(entry.nickname)}`}
      className={`min-w-0 flex-1 truncate text-sm font-bold transition-colors hover:text-accent sm:text-base ${
        me ? "text-accent" : ""
      }`}
    >
      {entry.nickname}
    </Link>
  );
}

function passRate(e: MatchInfoEntry): string {
  const t = e.pass?.passTry ?? 0;
  const s = e.pass?.passSuccess ?? 0;
  return t ? `${Math.round((s / t) * 100)}%` : "-";
}

function StatCompare({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="flex items-center py-2.5 text-sm">
      <span className="scoreboard w-20 flex-none text-left font-semibold text-accent">{a}</span>
      <span className="flex-1 text-center text-xs text-muted">{label}</span>
      <span className="scoreboard w-20 flex-none text-right font-semibold text-lose">{b}</span>
    </div>
  );
}

function RatingList({
  entry,
  names,
}: {
  entry: MatchInfoEntry;
  names: Map<number, string>;
}) {
  const players = (entry.player ?? [])
    .filter((p) => (p.status?.spRating ?? 0) > 0)
    .sort((a, b) => (b.status?.spRating ?? 0) - (a.status?.spRating ?? 0))
    .slice(0, 14);

  if (players.length === 0) {
    return (
      <div className="panel px-4 py-8 text-center text-xs text-muted">
        선수 기록 없음
      </div>
    );
  }

  return (
    <div className="panel divide-y divide-line/60 px-3">
      <p className="truncate py-2 text-xs font-semibold text-muted">{entry.nickname}</p>
      {players.map((p, i) => (
        <div key={`${p.spId}-${i}`} className="flex items-center gap-2.5 py-2">
          <Image
            src={`/api/player-image/${p.spId}`}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 flex-none rounded-lg bg-surface-2 object-cover"
          />
          <span className="scoreboard w-9 flex-none text-[11px] font-semibold text-muted">
            {getPositionLabel(p.spPosition)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]">
            {names.get(p.spId) ?? p.spId}
            {(p.status?.goal ?? 0) > 0 && (
              <span className="ml-1 text-accent">⚽{p.status.goal}</span>
            )}
            {(p.status?.assist ?? 0) > 0 && (
              <span className="ml-1 text-[11px] text-muted">A{p.status.assist}</span>
            )}
          </span>
          <span
            className={`scoreboard flex-none text-sm font-bold ${
              (p.status?.spRating ?? 0) >= 7.5
                ? "text-gold"
                : (p.status?.spRating ?? 0) < 6
                  ? "text-lose"
                  : ""
            }`}
          >
            {(p.status?.spRating ?? 0).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function MatchError({ err }: { err: unknown }) {
  const notConfigured = isNotConfigured(err);
  const notFound = err instanceof NexonApiError && err.code === 'OPENAPI00003';
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p className="scoreboard text-5xl font-bold text-surface-2">4:04</p>
      <h1 className="mt-4 text-xl font-bold">
        {notConfigured
          ? "서비스 준비 중입니다"
          : notFound
            ? "매치를 찾을 수 없어요"
            : "매치 정보를 불러올 수 없어요"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {notConfigured
          ? "넥슨 API 연동 설정이 완료되지 않았습니다."
          : "잠시 후 다시 시도해주세요."}
      </p>
      <Link
        href="/"
        className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
      >
        홈으로
      </Link>
    </div>
  );
}
