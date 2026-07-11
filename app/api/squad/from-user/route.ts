import { NextResponse } from "next/server";
import { getOuid, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import {
  isUserNotFound,
  isNotConfigured,
  isMaintenance,
} from "@/lib/nexon/client";
import { aggregatePlayers } from "@/lib/nexon/player-stats";
import { getPlayerNames, getSeasonNames } from "@/lib/nexon/players";
import { baseLabelOfCode } from "@/lib/squad/assign";

export const dynamic = "force-dynamic";

const MATCH_TYPE = 50; // 공식경기 기준
const MATCH_COUNT = 30;
const MIN_GAMES = 2;

/** 구단주명 → 최근 경기에서 자주 쓴 라인업(최대 11명)을 포지션과 함께 반환. */
export async function GET(req: Request) {
  const nickname = (new URL(req.url).searchParams.get("nickname") ?? "").trim();
  if (!nickname)
    return NextResponse.json({ error: "구단주명을 입력하세요." }, { status: 400 });

  try {
    const ouid = await getOuid(nickname);
    const matchIds = await getUserMatches(ouid, MATCH_TYPE, MATCH_COUNT);
    const details = await getMatchDetailsBatch(matchIds);
    const agg = aggregatePlayers(details, ouid)
      .filter((p) => p.games >= MIN_GAMES)
      .slice(0, 11);

    if (agg.length === 0)
      return NextResponse.json(
        { error: "최근 경기에서 스쿼드를 찾지 못했어요." },
        { status: 404 }
      );

    const names = await getPlayerNames(agg.map((p) => p.spId));
    const seasons = await getSeasonNames(agg.map((p) => p.spId));

    const players = agg.map((p) => ({
      spid: p.spId,
      name: names.get(p.spId) ?? `선수 ${p.spId}`,
      pos: baseLabelOfCode(p.mainPosition),
      season: seasons.get(p.spId) ?? "",
    }));

    return NextResponse.json({ nickname, players });
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
    return NextResponse.json(
      { error: "스쿼드를 불러오지 못했어요." },
      { status: 502 }
    );
  }
}
