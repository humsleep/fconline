import Image from "next/image";
import Link from "next/link";
import { getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { NexonApiError } from "@/lib/nexon/client";
import { getPositionLabel } from "@/lib/nexon/meta";
import { aggregatePlayers, type PlayerAggregate } from "@/lib/nexon/player-stats";
import { getPlayerNames } from "@/lib/nexon/players";
import { getRankerStatsCached, rankerKey, type RankerMap } from "@/lib/nexon/ranker";
import { loadPicks, topPickIdsByLine, isTopPick } from "@/lib/meta/picks";
import { verdictFromRating } from "@/lib/verdict";
import { diagnoseSquad } from "@/lib/squad-clinic";
import VerdictStamp from "@/app/components/VerdictStamp";
import ShareCardButton from "@/app/components/ShareCardButton";
import SquadClinic from "./SquadClinic";

const MATCH_COUNT = 30;
const MAX_CARDS = 18;
const MIN_GAMES = 2; // 표본 부족 선수는 제외 (덕후 신뢰 요건)

export default async function SquadSection({
  ouid,
  matchType,
  nickname,
}: {
  ouid: string;
  matchType: number;
  nickname: string;
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
          ? "이 매치 유형에는 최근 경기 기록이 없어요. 위의 다른 매치 유형 탭을 확인해 보세요."
          : `선수 성적표를 만들 표본이 부족해요. (${MIN_GAMES}경기 이상 출전 선수 없음)`}
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

  // 내 픽 vs 랭커 픽 — 라인별 인기 TOP10 픽과 대조. 매일 갱신되는 스냅샷 → 재방문 훅.
  // 대조는 spId×라인(정확 포지션 코드 아님 — ST=24/25/26 등 코드 별칭 오탐 방지).
  // 스냅샷은 공식(50)·감독(52)만 워밍 → 그 외 매치유형/콜드스타트면 idsByLine 비어 헤드라인 숨김.
  let idsByLine = new Map<string, Set<number>>();
  let pickDate: string | null = null;
  let hasPickData = false;
  try {
    const picks = await loadPicks(matchType, false);
    idsByLine = topPickIdsByLine(picks.byLine, 10);
    hasPickData = [...idsByLine.values()].some((s) => s.size > 0);
    if (hasPickData) pickDate = picks.date;
  } catch {
    // 스냅샷 없거나 조회 실패 → 헤드라인 숨김 (성적표는 정상 표시)
  }
  const topPickCount = hasPickData
    ? players.filter((p) => isTopPick(idsByLine, p.spId, p.mainPosition)).length
    : 0;
  const offTopCount = players.length - topPickCount;

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
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            스쿼드 실전 가치
          </p>
          <div className="mt-1.5">
            <VerdictStamp verdict={squadVerdict} size="lg" showLiner />
          </div>
        </div>
        <div className="flex-none text-right">
          <p className="text-[13px] text-muted">실사용 평점</p>
          <p className="scoreboard text-3xl font-bold text-accent">
            {squadRating.toFixed(2)}
          </p>
        </div>
      </section>

      {/* 내 픽 vs 랭커 픽 — 매일 갱신되는 인기 TOP10 픽과 겹치는 카드 수 (재방문 훅) */}
      {hasPickData && (
        <section className="panel mt-2 px-5 py-4">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            내 픽 vs 랭커 픽
          </p>
          <div className="mt-2 flex items-end gap-8">
            <div>
              <p className="scoreboard text-3xl font-bold text-win">
                {topPickCount}
                <span className="ml-0.5 text-base font-semibold text-muted">명</span>
              </p>
              <p className="text-[13px] text-muted">랭커 대세픽</p>
            </div>
            <div>
              <p className="scoreboard text-3xl font-bold text-ink">
                {offTopCount}
                <span className="ml-0.5 text-base font-semibold text-muted">명</span>
              </p>
              <p className="text-[13px] text-muted">TOP10 외</p>
            </div>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            내가 쓴 {players.length}명 중 랭커 인기 TOP10과 겹치는 카드
            {pickDate ? ` · ${pickDate} 스냅샷` : ""} · 매일 갱신
          </p>
          {/* 챌린지 공유 카드 — "너는 몇 명?"으로 보는 사람→검색 전환 (바이럴 루프) */}
          <div className="mt-3">
            <ShareCardButton
              url={`/api/card/pickmatch/${encodeURIComponent(nickname)}?mt=${matchType}`}
              filename={`fcscope-pick-${nickname}.png`}
              label="🔥 랭커 대세픽 카드"
            />
          </div>
        </section>
      )}

      <p className="mt-3 text-sm text-muted">
        최근 {details.length}경기 · {MIN_GAMES}경기 이상 출전 선수 · 랭커 평균은
        같은 포지션 상위 랭커 기준
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {players.map((p) => (
          <PlayerCard
            key={p.spId}
            p={p}
            name={names.get(p.spId) ?? `선수 ${p.spId}`}
            ranker={rankerCompare(ranker.get(rankerKey(p.spId, p.mainPosition))?.status)}
            topPick={hasPickData && isTopPick(idsByLine, p.spId, p.mainPosition)}
          />
        ))}
      </div>
    </>
  );
}

/** 랭커 status → 비교용 실스탯. matchCount 0이면 undefined(비교 숨김). */
function rankerCompare(
  st: { goal?: number; passTry?: number; passSuccess?: number; matchCount?: number } | undefined
): { goal: number; passRate: number } | undefined {
  if (!st || (st.matchCount ?? 0) <= 0) return undefined;
  const passTry = st.passTry ?? 0;
  return {
    goal: Math.round((st.goal ?? 0) * 100) / 100,
    passRate: passTry > 0 ? Math.round(((st.passSuccess ?? 0) / passTry) * 100) : 0,
  };
}

function Compare({
  label,
  mine,
  ranker,
  suffix = "",
}: {
  label: string;
  mine: number;
  ranker: number;
  suffix?: string;
}) {
  const win = mine >= ranker;
  return (
    <div className="rounded bg-surface-2 px-2 py-1.5">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="scoreboard mt-0.5 text-[13px] font-bold">
        <span className={win ? "text-win" : "text-ink"}>
          나 {mine}{suffix}
        </span>
        <span className="mx-1 font-normal text-muted">·</span>
        <span className="text-muted">랭커 {ranker}{suffix}</span>
      </p>
    </div>
  );
}

function PlayerCard({
  p,
  name,
  ranker,
  topPick,
}: {
  p: PlayerAggregate;
  name: string;
  ranker?: { goal: number; passRate: number };
  topPick?: boolean;
}) {
  // 선수(게임 카드) 판정 — 내 실사용 평점 기준(match-detail spRating, 유효).
  const verdict = verdictFromRating({
    rating: p.avgRating,
    subjectType: "player",
    seed: p.spId,
  });

  return (
    <Link
      href={`/player/${p.spId}`}
      className="panel block p-3 transition-colors hover:border-accent/50"
    >
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
            <span className="ml-1.5 text-sm font-medium text-muted">
              {getPositionLabel(p.mainPosition)}
            </span>
            {topPick && (
              <span className="ml-1.5 rounded bg-win/15 px-1.5 py-0.5 text-[11px] font-bold text-win">
                🔥 대세픽
              </span>
            )}
            <span className="ml-1.5 text-[12px] font-semibold text-accent">도감 →</span>
          </p>
          <div className="mt-1">
            <VerdictStamp verdict={verdict} />
          </div>
        </div>

        <div className="flex-none text-right">
          <p className="text-[13px] text-muted">평균 평점</p>
          <p className="scoreboard text-2xl font-bold text-ink">
            {p.avgRating.toFixed(1)}
          </p>
        </div>
      </div>

      {/* 내 카드 vs 랭커 실스탯 (평점은 ranker-stats에 없어 골·패스%로 비교) */}
      {ranker && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Compare label={`경기당 골 vs 랭커 ${getPositionLabel(p.mainPosition)}`} mine={p.goalsPerGame} ranker={ranker.goal} />
          <Compare label="패스 성공률" mine={p.passRate} ranker={ranker.passRate} suffix="%" />
        </div>
      )}

      <p className="scoreboard mt-2 text-sm text-muted">
        {p.games}경기 · ⚽{p.goals} A{p.assists} · 패스 {p.passRate}%
      </p>
    </Link>
  );
}
