import Image from "next/image";
import { getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailCached } from "@/lib/nexon/cached";
import { NexonApiError } from "@/lib/nexon/client";
import { getPositionLabel } from "@/lib/nexon/meta";
import { aggregatePlayers, type PlayerAggregate } from "@/lib/nexon/player-stats";
import { getPlayerNames } from "@/lib/nexon/players";
import { getRankerStatsCached, rankerKey, type RankerMap } from "@/lib/nexon/ranker";
import type { MatchDetail } from "@/lib/nexon/types";

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

  const details: MatchDetail[] = [];
  for (const id of matchIds) {
    try {
      details.push(await getMatchDetailCached(id));
    } catch {
      // 개별 매치 실패는 건너뜀
    }
  }

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

  return (
    <>
      <p className="mt-4 text-[11px] text-muted">
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
  const ratingColor =
    p.avgRating >= 7.5 ? "text-gold" : p.avgRating < 6 ? "text-lose" : "text-ink";

  const gap =
    typeof rankerRating === "number" && rankerRating > 0
      ? p.avgRating - rankerRating
      : null;

  return (
    <div className="panel flex items-center gap-3 p-3">
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
          <span className="ml-1.5 text-[11px] font-medium text-muted">
            {getPositionLabel(p.mainPosition)}
          </span>
        </p>
        <p className="scoreboard mt-0.5 text-[11px] text-muted">
          {p.games}경기 · ⚽{p.goals} A{p.assists} · 패스 {p.passRate}%
        </p>
        {gap !== null && (
          <p className="mt-0.5 text-[11px]">
            <span className="text-muted">
              랭커 {getPositionLabel(p.mainPosition)}{" "}
            </span>
            <span className="scoreboard font-semibold text-muted">
              {rankerRating!.toFixed(1)}
            </span>
            <span
              className={`scoreboard ml-1.5 font-bold ${
                gap > 0 ? "text-win" : gap < 0 ? "text-lose" : "text-muted"
              }`}
            >
              {gap > 0 ? "+" : gap < 0 ? "" : "±"}
              {gap.toFixed(1)}
            </span>
          </p>
        )}
      </div>

      <div className="flex-none text-right">
        <p className="text-[10px] text-muted">평균 평점</p>
        <p className={`scoreboard text-2xl font-bold ${ratingColor}`}>
          {p.avgRating.toFixed(1)}
        </p>
      </div>
    </div>
  );
}
