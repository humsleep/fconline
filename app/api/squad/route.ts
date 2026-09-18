import { saveSquad, type SquadSlot } from "@/lib/squad/store";
import { getFormation, FORMATIONS } from "@/lib/squad/formations";
import { clientIpFrom, hashIp } from "@/lib/security/ip-hash";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 스쿼드 저장 → 공유 id 반환
const POSITION_LABELS = new Set([
  "GK", "SW", "LWB", "RWB", "LB", "RB", "CB", "LCB", "RCB", "CDM", "LDM", "RDM", "CM", "LCM", "RCM",
  "LM", "RM", "CAM", "LAM", "RAM", "LW", "RW", "CF", "LF", "RF", "ST", "LS", "RS",
]);

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
  const seen = new Set<string>();
  const seenPid = new Set<number>(); // 시즌 달라도 같은 선수(pid) 중복 배치 방지 (인게임 규칙)
  for (const raw of body.slots as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue;
    const s = raw as Record<string, unknown>;
    const slotId = s.slotId;
    const spid = s.spid;
    const nm = s.name;
    const pid = typeof spid === "number" ? spid % 1_000_000 : -1;
    if (
      typeof slotId === "string" &&
      validSlotIds.has(slotId) &&
      !seen.has(slotId) &&
      typeof spid === "number" &&
      Number.isInteger(spid) &&
      spid > 0 &&
      !seenPid.has(pid) &&
      typeof nm === "string"
    ) {
      seen.add(slotId);
      seenPid.add(pid);
      const slot: SquadSlot = { slotId, spid, name: nm.slice(0, 40) };
      // 표시 사진(선택) — 반드시 같은 선수(pid)의 사진만. 다른 선수 사진으로 바꿔 끼우는 것을 막는다.
      // 선수별 포지션(선택) — FC온라인 포지션 라벨만 받는다. 앱에서 자리를 끌어 옮기면 그 선수만 라벨이 바뀐다.
      if (typeof s.pos === "string" && POSITION_LABELS.has(s.pos)) slot.pos = s.pos;
      const img = s.imageSpid;
      if (typeof img === "number" && Number.isInteger(img) && img > 0 && img !== spid && img % 1_000_000 === pid) {
        slot.imageSpid = img;
      }
      // 커스텀 좌표(선택) — 0~100 범위만
      const x = s.x;
      const y = s.y;
      if (typeof x === "number" && x >= 0 && x <= 100 && typeof y === "number" && y >= 0 && y <= 100) {
        slot.x = x;
        slot.y = y;
      }
      slots.push(slot);
    }
  }
  if (slots.length === 0) {
    return Response.json({ error: "no valid slots" }, { status: 400 });
  }

  const teamTag =
    typeof body.teamTag === "string" && /^[a-z0-9]{1,20}$/.test(body.teamTag)
      ? body.teamTag
      : null;

  const ipHash = hashIp(clientIpFrom(req.headers));
  // 로그인 상태면 계정에 귀속(크로스기기·lock-in). 미로그인은 익명 저장 유지.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Supabase 미설정 등 — 익명 저장
  }
  const id = await saveSquad({ name, formation: formationId, slots, teamTag, ipHash, userId });
  if (id === "rate_limited") {
    return Response.json(
      { error: "오늘 저장 한도에 도달했어요. 내일 다시 시도해 주세요." },
      { status: 429 }
    );
  }
  if (!id) {
    return Response.json({ error: "save failed" }, { status: 503 });
  }
  return Response.json({ id });
}
