import { getOuid, getUserBasic, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { summarizeMatch, topRivals, type MatchSummary, type Rival } from "@/lib/nexon/summary";
import { renderCard } from "@/lib/card/render";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/** 라이벌 서사(천적/호구) — 페이지 RivalsPanel과 동일 규칙. */
function labelOf(r: Rival): { text: string; icon: string; color: "gold" | "lime" | "lose" } {
  const diff = r.win - r.lose;
  if (r.games >= 3 && diff <= -2) return { text: "천적", icon: "▼", color: "lose" };
  if (r.games >= 3 && diff >= 2) return { text: "호구", icon: "▲", color: "lime" };
  return { text: "라이벌", icon: "⚔", color: "gold" };
}

/**
 * 헤드라인 라이벌 선정: 천적(가장 크게 지는) 우선 → 호구(가장 크게 이기는) →
 * 없으면 최다 대전(topRivals 정렬상 [0]). ?vs= 로 특정 상대 지정 가능.
 */
function pickRival(rivals: Rival[], vs: string | null): Rival | null {
  if (rivals.length === 0) return null;
  if (vs) {
    const hit = rivals.find((r) => r.nickname === vs);
    if (hit) return hit;
  }
  const nemesis = rivals
    .filter((r) => r.games >= 3 && r.win - r.lose <= -2)
    .sort((a, b) => a.win - a.lose - (b.win - b.lose))[0];
  if (nemesis) return nemesis;
  const prey = rivals
    .filter((r) => r.games >= 3 && r.win - r.lose >= 2)
    .sort((a, b) => b.win - b.lose - (a.win - a.lose))[0];
  if (prey) return prey;
  return rivals[0];
}

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
  const vs = new URL(req.url).searchParams.get("vs");

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

    const rival = pickRival(topRivals(summaries), vs);

    // 라이벌이 없으면(2회 이상 만난 상대 없음) 안내형 카드
    if (!rival) {
      return renderCard({
        kicker: "라이벌 H2H",
        title: "—",
        subtitle: `${basic.nickname} · 아직 자주 만난 상대가 없어요`,
        badges: [{ label: "최근 경기", value: `${summaries.length}` }],
        footerUrl: "fcscope",
      });
    }

    const lab = labelOf(rival);
    return renderCard({
      kicker: "라이벌 H2H",
      title: `${rival.win} : ${rival.lose}`,
      subtitle: `${basic.nickname} vs ${rival.nickname}`,
      stamp: { text: lab.text, icon: lab.icon, color: lab.color },
      badges: [
        { label: "무", value: `${rival.draw}` },
        { label: "득실", value: `${rival.goalsFor}:${rival.goalsAgainst}` },
        { label: "맞대결", value: `${rival.games}경기` },
      ],
      footerUrl: "fcscope",
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
