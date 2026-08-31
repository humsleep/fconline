import { getOuid, getUserBasic, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { weeklyRecap } from "@/lib/nexon/weekly";
import { renderCard } from "@/lib/card/render";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * 주간 성적표 카드 — "이번 주 3승 1패 · 평균 스코어 8.2" 9:16 자랑 카드.
 * 이미 있는 최근 경기만 사용(추가 넥슨 팬아웃은 카드 렌더용 1회). rival/streak 카드와 동일 파이프라인.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ nickname: string }> }
) {
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

  try {
    const ouid = await getOuid(decoded);
    const basic = await getUserBasic(ouid);

    const ids = await getUserMatches(ouid, 50, 20).catch(() => [] as string[]);
    const details = await getMatchDetailsBatch(ids);
    const summaries: MatchSummary[] = [];
    for (const d of details) {
      const s = summarizeMatch(d, ouid);
      if (s) summaries.push(s);
    }

    const w = weeklyRecap(summaries);
    if (w.games === 0) {
      return renderCard({
        kicker: "주간 리포트",
        title: "—",
        subtitle: `${basic.nickname} · 최근 7일 공식경기 없음`,
        footerUrl: "fcscope",
      });
    }

    const color: "gold" | "lime" | "lose" =
      w.winRate >= 60 ? "gold" : w.winRate >= 45 ? "lime" : "lose";
    return renderCard({
      kicker: "주간 리포트",
      title: `${w.win}승 ${w.draw}무 ${w.lose}패`,
      subtitle: `${basic.nickname} · 최근 7일 ${w.games}경기`,
      stamp: {
        text: w.bestStreak >= 2 ? `이번 주 ${w.bestStreak}연승` : `승률 ${w.winRate}%`,
        icon: w.winRate >= 45 ? "▲" : "▼",
        color,
      },
      badges: [
        { label: "승률", value: `${w.winRate}%`, color },
        { label: "평균 스코어", value: w.avgScore.toFixed(1) },
        { label: "득실", value: `${w.goalsFor}:${w.goalsAgainst}` },
      ],
      footerUrl: "fcscope",
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
