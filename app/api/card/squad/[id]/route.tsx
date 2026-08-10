import { getSquad } from "@/lib/squad/store";
import { getSeasonNames } from "@/lib/nexon/players";
import { renderSquadCard } from "@/lib/card/squad-card";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60; // 선수 사진+시즌 엠블럼 최대 ~22개 서버 프리페치

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // DB 읽기 + 시즌 프리페치(~22) 유발 — 임의 id 반복 조회 방어(형제 카드와 동일 버킷)
  const rl = limitNexonFanout(req.headers, "card");
  if (!rl.ok)
    return new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });

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
