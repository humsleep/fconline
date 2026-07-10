import Image from "next/image";
import { getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { NexonApiError } from "@/lib/nexon/client";
import { getPositionLabel } from "@/lib/nexon/meta";
import { aggregatePlayers, type PlayerAggregate } from "@/lib/nexon/player-stats";
import { getPlayerNames } from "@/lib/nexon/players";
import { getRankerStatsCached, rankerKey, type RankerMap } from "@/lib/nexon/ranker";
import { verdictFromRating } from "@/lib/verdict";
import { diagnoseSquad } from "@/lib/squad-clinic";
import VerdictStamp from "@/app/components/VerdictStamp";
import TugOfWar from "@/app/components/TugOfWar";
import SquadClinic from "./SquadClinic";

const MATCH_COUNT = 30;
const MAX_CARDS = 18;
const MIN_GAMES = 2; // 표본 부족 선수는 제외 (덕후 신뢰 요건)

export default async function SquadSection({
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
  const all = aggregatePlayers(details, ouid);
  const players = all.filter((p) => p.games >= MIN_GAMES).slice(0, MAX_CARDS);

  if (players.length === 0) {
    return (
      <div className="panel mt-4 px-6 py-14 text-center text-sm text-muted">
        {details.length === 0
          ? "최근 경기 기록이 없습니다."
          : `선수 성적표를 만들 표본이 부족합니다. (${MIN_GAMES}경기 이상 출전 선수 없음)`}
      </div>
    );
  }

  // 랭커 벤치마크 — 스쿼드 선수 전체를 한 번에 조회
  let ranker: RankerMap = new Map();
  try {
    ranker = await getRankerStatsCached(
      matchType,
      players.map((p) => ({ id: p.spId, po: p.mainPosition }))
    );
  } catch {
    // 랭커 데이터 없이도 성적표는 표시
  }

  const names = await getPlayerNames(players.map((p) => p.spId));

  // 클리닉 진단 — 이미 집계된 players + 랭커 맵 재사용(추가 fetch 없음)
  const clinic = diagnoseSquad(
    players,
    (spId, position) => ranker.get(rankerKey(spId, position))?.status?.spRating
  );

  // 실전 가치 — 금액(시세) 대신, 스쿼드의 실사용 평점을 출전 수로 가중 평균
  // (클리닉이 동일 공식으로 계산하므로 있으면 재사용)
  const totalGames = players.reduce((s, p) => s + p.games, 0);
  const squadRating =
    clinic?.squadRating ??
    (totalGames > 0
      ? players.reduce((s, p) => s + p.avgRating * p.games, 0) / totalGames
      : 0);
  const squadVerdict = verdictFromRating({
    rating: squadRating,
    subjectType: "player",
    seed: "squad",
  });

  return (
    <>
      {clinic && (
        <SquadClinic result={clinic} names={names} matches={details.length} />
      )}

      {/* 실전 가치 요약 (구단가치 대체) */}
      <section className="panel mt-4 flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="scoreboard text-[12px] font-semibold tracking-[0.2em] text-muted">
            스쿼드 실전 가치
          </p>
          <div className="mt-1.5">
            <VerdictStamp verdict={squadVerdict} size="lg" showLiner />
          </div>
        </div>
        <div className="flex-none text-right">
          <p className="text-[12px] text-muted">실사용 평점</p>
          <p className="scoreboard text-3xl font-bold text-accent">
            {squadRating.toFixed(2)}
          </p>
        </div>
      </section>

      <p className="mt-3 text-[13px] text-muted">
        최근 {details.length}경기 · {MIN_GAMES}경기 이상 출전 선수 · 랭커 평균은
        같은 포지션 상위 랭커 기준
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {players.map((p) => (
          <PlayerCard
            key={p.spId}
            p={p}
            name={names.get(p.spId) ?? `선수 ${p.spId}`}
            rankerRating={
              ranker.get(rankerKey(p.spId, p.mainPosition))?.status?.spRating
            }
          />
        ))}
      </div>
    </>
  );
}

function PlayerCard({
  p,
  name,
  rankerRating,
}: {
  p: PlayerAggregate;
  name: string;
  rankerRating?: number;
}) {
  const hasRanker = typeof rankerRating === "number" && rankerRating > 0;
  const gap = hasRanker ? p.avgRating - rankerRating! : undefined;

  // 선수(게임 카드) 판정 — subjectType 'player'(카드 놀리기 허용). 문구는 spId로 고정.
  const verdict = verdictFromRating({
    rating: p.avgRating,
    subjectType: "player",
    seed: p.spId,
    rankerGap: gap,
  });

  return (
    <div className="panel p-3">
      <div className="flex items-center gap-3">
        <Image
          src={`/api/player-image/${p.spId}`}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="h-12 w-12 flex-none rounded-lg bg-surface-2 object-cover"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {name}
            <span className="ml-1.5 text-[13px] font-medium text-muted">
              {getPositionLabel(p.mainPosition)}
            </span>
          </p>
          <div className="mt-1">
            <VerdictStamp verdict={verdict} />
          </div>
        </div>

        <div className="flex-none text-right">
          <p className="text-[12px] text-muted">평균 평점</p>
          <p className="scoreboard text-2xl font-bold text-ink">
            {p.avgRating.toFixed(1)}
          </p>
        </div>
      </div>

      {/* 랭커 대비 — tug-of-war 발광 바 */}
      {hasRanker && (
        <div className="mt-2.5">
          <TugOfWar
            label={`평점 vs 랭커 ${getPositionLabel(p.mainPosition)}`}
            mine={p.avgRating}
            ranker={rankerRating!}
            max={10}
          />
        </div>
      )}

      <p className="scoreboard mt-2 text-[13px] text-muted">
        {p.games}경기 · ⚽{p.goals} A{p.assists} · 패스 {p.passRate}%
      </p>
    </div>
  );
}
