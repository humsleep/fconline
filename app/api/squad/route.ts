import { saveSquad, type SquadSlot } from "@/lib/squad/store";
import { getFormation, FORMATIONS } from "@/lib/squad/formations";

export const dynamic = "force-dynamic";

// 스쿼드 저장 → 공유 id 반환
export async function POST(req: Request) {
  let body: {
    name?: unknown;
    formation?: unknown;
    slots?: unknown;
    teamTag?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "내 스쿼드";
  const formationId = typeof body.formation === "string" ? body.formation : "";
  if (!FORMATIONS.some((f) => f.id === formationId)) {
    return Response.json({ error: "invalid formation" }, { status: 400 });
  }

  const validSlotIds = new Set(getFormation(formationId).slots.map((s) => s.id));
  if (!Array.isArray(body.slots) || body.slots.length === 0 || body.slots.length > 11) {
    return Response.json({ error: "invalid slots" }, { status: 400 });
  }

  const slots: SquadSlot[] = [];
  for (const raw of body.slots as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue;
    const s = raw as Record<string, unknown>;
    const slotId = s.slotId;
    const spid = s.spid;
    const nm = s.name;
    if (
      typeof slotId === "string" &&
      validSlotIds.has(slotId) &&
      typeof spid === "number" &&
      Number.isInteger(spid) &&
      spid > 0 &&
      typeof nm === "string"
    ) {
      slots.push({ slotId, spid, name: nm.slice(0, 40) });
    }
  }
  if (slots.length === 0) {
    return Response.json({ error: "no valid slots" }, { status: 400 });
  }

  const teamTag =
    typeof body.teamTag === "string" && /^[a-z0-9]{1,20}$/.test(body.teamTag)
      ? body.teamTag
      : null;

  const id = await saveSquad({ name, formation: formationId, slots, teamTag });
  if (!id) {
    return Response.json({ error: "save failed" }, { status: 503 });
  }
  return Response.json({ id });
}
