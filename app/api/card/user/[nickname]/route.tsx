import { getMaxDivisions, getOuid, getUserBasic, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { getDivisionName } from "@/lib/nexon/meta";
import { aggregate, summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { recentScore, scoreTier } from "@/lib/nexon/score";
import { renderCard } from "@/lib/card/render";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ nickname: string }> }
) {
  // 매치 20건 팬아웃 유발 — IP rate limit (미들웨어 제외 경로라 여기서 직접)
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

    const divisions = await getMaxDivisions(ouid).catch(() => []);
    const official = divisions.find((d) => d.matchType === 50) ?? divisions[0];
    const divisionName = official ? await getDivisionName(official.division) : "";

    const ids = await getUserMatches(ouid, 50, 20).catch(() => [] as string[]);
    const details = await getMatchDetailsBatch(ids);
    const summaries: MatchSummary[] = [];
    for (const d of details) {
      const s = summarizeMatch(d, ouid);
      if (s) summaries.push(s);
    }
    const rec = aggregate(summaries);
    const score = recentScore(summaries);
    const tier = scoreTier(score);
    const tierColor =
      tier.tone === "gold" ? "gold" : tier.tone === "lose" ? "lose" : "lime";

    return renderCard({
      kicker: "전적 카드",
      title: `${rec.winRate}%`,
      subtitle: `${basic.nickname} · Lv.${basic.level}${
        divisionName ? ` · ${divisionName}` : ""
      }`,
      stamp: rec.played
        ? { text: `${rec.win}승 ${rec.draw}무 ${rec.lose}패`, icon: "▲", color: "lime" }
        : undefined,
      badges: [
        // FC Scope 스코어를 대표 배지로 (표본 있을 때만)
        ...(rec.played
          ? [{ label: "FC 스코어", value: score.toFixed(1), color: tierColor as "gold" | "lime" | "lose" }]
          : []),
        { label: "최근 경기", value: `${rec.played}` },
        { label: "득실", value: `${rec.goalsFor}:${rec.goalsAgainst}` },
      ],
      footerUrl: "fcscope",
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
