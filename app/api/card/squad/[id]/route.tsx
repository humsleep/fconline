import { getFormation } from "@/lib/squad/formations";
import { getSquad } from "@/lib/squad/store";
import { getSeasonNames } from "@/lib/nexon/players";
import { renderCard } from "@/lib/card/render";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const squad = await getSquad(id);
    if (!squad) return new Response("not found", { status: 404 });

    // 배지: 핵심 선수 2명 + 최다 시즌 구성 (자랑 포인트)
    const names = squad.slots.map((s) => s.name).filter(Boolean);
    const picks = names.slice(0, 2);

    const seasons = await getSeasonNames(squad.slots.map((s) => s.spid));
    const seasonCount = new Map<string, number>();
    for (const s of squad.slots) {
      const key = s.season ?? seasons.get(s.spid) ?? "";
      if (!key) continue;
      seasonCount.set(key, (seasonCount.get(key) ?? 0) + 1);
    }
    const topSeason = [...seasonCount.entries()].sort((a, b) => b[1] - a[1])[0];

    const badges = [
      ...picks.map((n) => ({ label: "핵심", value: n })),
      ...(topSeason
        ? [{ label: "시즌 구성", value: `${topSeason[0]} ×${topSeason[1]}`, color: "gold" as const }]
        : []),
    ].slice(0, 3);

    return renderCard({
      kicker: "스쿼드",
      title: getFormation(squad.formation).name,
      subtitle: squad.name,
      stamp: { text: `${squad.slots.length}명 구성`, icon: "", color: "lime" },
      badges,
      footerUrl: "fcscope",
    });
  } catch {
    return new Response("error", { status: 500 });
  }
}
