import { getSquad } from "@/lib/squad/store";
import { getSeasonNames } from "@/lib/nexon/players";
import { renderSquadCard } from "@/lib/card/squad-card";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const squad = await getSquad(id);
    if (!squad) return new Response("not found", { status: 404 });

    // 스쿼드는 포메이션 피치로 렌더 — 범용 텍스트 카드가 아니라 실제 배치를 그린다.
    const seasons = await getSeasonNames(squad.slots.map((s) => s.spid));
    return renderSquadCard(squad, seasons);
  } catch {
    return new Response("error", { status: 500 });
  }
}
