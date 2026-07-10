import { getFormation } from "@/lib/squad/formations";
import { getSquad } from "@/lib/squad/store";
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

    // 대표 공격진 3명 (없으면 앞 슬롯) 을 배지로
    const names = squad.slots.map((s) => s.name).filter(Boolean);
    const picks = names.slice(0, 3);

    return renderCard({
      kicker: "스쿼드",
      title: getFormation(squad.formation).name,
      subtitle: squad.name,
      stamp: { text: `${squad.slots.length}명 구성`, icon: "", color: "lime" },
      badges: picks.map((n) => ({ label: "", value: n })),
      footerUrl: "fcscope",
    });
  } catch {
    return new Response("error", { status: 500 });
  }
}
