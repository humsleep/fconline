import { NextResponse } from "next/server";
import { getOuid, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import {
  isUserNotFound,
  isNotConfigured,
  isMaintenance,
  isPaused,
} from "@/lib/nexon/client";
import type { MatchPlayer } from "@/lib/nexon/types";
import { getPlayerNames, getSeasonNames } from "@/lib/nexon/players";
import { baseLabelOfCode, bestFormationId } from "@/lib/squad/assign";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MATCH_TYPE = 50; // 공식경기 기준
const MATCH_COUNT = 5; // 최신 경기에 선발 데이터가 없을 때를 대비한 후보 수

/** SUB(28) 제외 = 킥오프 시점 선발 라인업 */
const SUB_POSITION = 28;

function startersOf(players: MatchPlayer[]): MatchPlayer[] {
  return players
    .filter((p) => p.spPosition >= 0 && p.spPosition < SUB_POSITION)
    .sort((a, b) => a.spPosition - b.spPosition)
    .slice(0, 11);
}

/** 구단주명 → 가장 최근 공식경기에서 실제 사용한 선발 11명 + 포메이션 반환. */
export async function GET(req: Request) {
  const rl = limitNexonFanout(req.headers, "from-user");
  if (!rl.ok)
    return NextResponse.json(
      { error: "잠시 후 다시 시도해 주세요. 요청이 너무 많아요." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );

  const nickname = (new URL(req.url).searchParams.get("nickname") ?? "").trim();
  if (!nickname)
    return NextResponse.json({ error: "구단주명을 입력하세요." }, { status: 400 });

  try {
    const ouid = await getOuid(nickname);
    const matchIds = await getUserMatches(ouid, MATCH_TYPE, MATCH_COUNT);
    const details = await getMatchDetailsBatch(matchIds);

    // 최신 경기부터: 선발 11명이 온전히 잡힌 첫 경기를 채택, 없으면 가장 많이 잡힌 경기
    let lineup: MatchPlayer[] = [];
    let matchDate: string | null = null;
    for (const detail of details) {
      const entry = detail.matchInfo?.find((e) => e.ouid === ouid);
      if (!entry) continue;
      const starters = startersOf(entry.player ?? []);
      if (starters.length === 11) {
        lineup = starters;
        matchDate = detail.matchDate ?? null;
        break;
      }
      if (starters.length > lineup.length) {
        lineup = starters;
        matchDate = detail.matchDate ?? null;
      }
    }

    if (lineup.length === 0)
      return NextResponse.json(
        { error: "최근 경기에서 스쿼드를 찾지 못했어요." },
        { status: 404 }
      );

    const names = await getPlayerNames(lineup.map((p) => p.spId));
    const seasons = await getSeasonNames(lineup.map((p) => p.spId));

    const players = lineup.map((p) => ({
      spid: p.spId,
      name: names.get(p.spId) ?? `선수 ${p.spId}`,
      pos: baseLabelOfCode(p.spPosition),
      season: seasons.get(p.spId) ?? "",
    }));

    const formation = bestFormationId(players.map((p) => p.pos));

    return NextResponse.json({ nickname, formation, matchDate, players });
  } catch (err) {
    if (isUserNotFound(err))
      return NextResponse.json(
        { error: "해당 구단주명을 찾을 수 없어요." },
        { status: 404 }
      );
    if (isNotConfigured(err))
      return NextResponse.json(
        { error: "넥슨 API 연동 설정이 완료되지 않았어요." },
        { status: 503 }
      );
    if (isMaintenance(err))
      return NextResponse.json(
        { error: "넥슨 API 점검 중입니다." },
        { status: 503 }
      );
    if (isPaused(err))
      return NextResponse.json(
        { error: "전적 조회를 잠시 멈췄어요. 곧 다시 열립니다." },
        { status: 503 }
      );
    return NextResponse.json(
      { error: "스쿼드를 불러오지 못했어요." },
      { status: 502 }
    );
  }
}
