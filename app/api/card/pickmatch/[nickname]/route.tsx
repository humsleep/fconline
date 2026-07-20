import { getOuid, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { aggregatePlayers } from "@/lib/nexon/player-stats";
import { loadPicks, topPickIdsByLine, isTopPick } from "@/lib/meta/picks";
import { renderCard } from "@/lib/card/render";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// SquadSection과 동일 상수 — 카드의 N이 페이지에 보인 숫자와 반드시 일치해야 함
const MATCH_COUNT = 30;
const MAX_CARDS = 18;
const MIN_GAMES = 2;

/** 랭커 대세픽 챌린지 카드 — "내 스쿼드 랭커 대세픽 N명, 너는?" (바이럴 루프) */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ nickname: string }> }
) {
  // 매치 30건 팬아웃 유발 — IP rate limit (미들웨어 제외 경로)
  const rl = limitNexonFanout(req.headers, "card");
  if (!rl.ok)
    return new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });

  const { nickname } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(nickname);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // 공유한 탭과 카드가 일치하도록 mt 파라미터 사용. 스냅샷은 50/52만 워밍 → 그 외는 데이터 없어 404.
  const mtParam = Number(new URL(req.url).searchParams.get("mt"));
  const matchType = mtParam === 52 ? 52 : 50;

  try {
    const ouid = await getOuid(decoded);
    const ids = await getUserMatches(ouid, matchType, MATCH_COUNT).catch(
      () => [] as string[]
    );
    const details = await getMatchDetailsBatch(ids);
    const players = aggregatePlayers(details, ouid)
      .filter((p) => p.games >= MIN_GAMES)
      .slice(0, MAX_CARDS);
    if (players.length === 0) return new Response("no squad", { status: 404 });

    const picks = await loadPicks(matchType, false);
    const idsByLine = topPickIdsByLine(picks.byLine, 10);
    const hasPickData = [...idsByLine.values()].some((s) => s.size > 0);
    if (!hasPickData) return new Response("no snapshot", { status: 404 });

    const total = players.length;
    const n = players.filter((p) =>
      isTopPick(idsByLine, p.spId, p.mainPosition)
    ).length;

    return renderCard({
      kicker: "내 스쿼드 vs 랭커 대세픽",
      title: `${n}명`,
      subtitle: `인기 랭커픽 TOP10 기준 · ${decoded}`,
      stamp: { text: "너는 몇 명?", icon: "", color: "lime" },
      badges: [
        { label: "내가 쓴 카드", value: `${total}명` },
        { label: "TOP10 외", value: `${total - n}명`, color: "muted" },
        { label: "기준일", value: picks.date ?? "최신" },
      ],
      footerUrl: "fcscope",
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
