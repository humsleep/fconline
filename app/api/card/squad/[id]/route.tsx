import { getFormation } from "@/lib/squad/formations";
import { getSquad } from "@/lib/squad/store";
import { getSeasonNames } from "@/lib/nexon/players";
import { pickKeyPlayers, topSeason } from "@/lib/squad/card-badges";
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

    // 배지: 핵심 선수 2명(공격 포지션 우선) + 최다 시즌 구성 (자랑 포인트)
    const seasons = await getSeasonNames(squad.slots.map((s) => s.spid));
    const picks = pickKeyPlayers(squad, 2);
    const top = topSeason(squad, seasons);

    const badges = [
      ...picks.map((n) => ({ label: "핵심", value: n })),
      ...(top
        ? [{ label: "시즌 구성", value: `${top.season} ×${top.count}`, color: "gold" as const }]
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
