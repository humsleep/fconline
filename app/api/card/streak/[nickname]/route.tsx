import { getOuid, getUserBasic, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { computeMatchPerfStats } from "@/lib/match/diagnosis";
import { recentScore } from "@/lib/nexon/score";
import { streakLabel } from "@/lib/nexon/streak-card";
import { renderCard } from "@/lib/card/render";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * 연승/폼 하이라이트 카드 — "나 지금 N연승" 자랑 + 유입. 이미 페칭되는 최근 경기만 사용.
 * rival 카드와 동일 파이프라인(rate-limit·렌더러 재사용). 마이그레이션 불필요.
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

    if (summaries.length === 0) {
      return renderCard({
        kicker: "이번 폼",
        title: "—",
        subtitle: `${basic.nickname} · 최근 공식경기 기록이 없어요`,
        footerUrl: "fcscope",
      });
    }

    const stats = computeMatchPerfStats(summaries);
    const score = recentScore(summaries);
    const lab = streakLabel(stats);

    return renderCard({
      kicker: "이번 폼",
      title: lab.text,
      subtitle: `${basic.nickname} · 최근 ${stats.played}경기`,
      stamp: { text: `FC스코어 ${score.toFixed(1)}`, icon: lab.icon, color: lab.color },
      badges: [
        { label: "승률", value: `${stats.winRate}%`, color: lab.color },
        { label: "최고 연승", value: `${stats.bestWinStreak}` },
        { label: "최근 경기", value: `${stats.played}` },
      ],
      footerUrl: "fcscope",
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
