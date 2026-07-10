import { getPositionLabel } from "@/lib/nexon/meta";
import { buildComparison, getTodaysVs, VS_MATCH_TYPE } from "@/lib/vs";
import { renderCard } from "@/lib/card/render";

export const runtime = "nodejs";

function toInt(v: string | null, max: number): number | null {
  if (!v || !/^\d{1,9}$/.test(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const a = toInt(sp.get("a"), 999999999);
  const b = toInt(sp.get("b"), 999999999);
  const pos = toInt(sp.get("pos"), 28);

  try {
    let cmp;
    if (a !== null && b !== null && pos !== null && a !== b) {
      cmp = await buildComparison(a, b, pos);
    } else {
      const today = await getTodaysVs(VS_MATCH_TYPE);
      if (today) cmp = await buildComparison(today.aSpId, today.bSpId, today.pos);
    }

    if (!cmp || !cmp.available || !cmp.a || !cmp.b) {
      return new Response("no data", { status: 404 });
    }

    const win = cmp.winner === "A" ? cmp.a : cmp.winner === "B" ? cmp.b : null;

    return renderCard({
      kicker: `오늘의 VS · ${getPositionLabel(cmp.pos)}`,
      title: `${cmp.a.rating.toFixed(1)} : ${cmp.b.rating.toFixed(1)}`,
      subtitle: `${cmp.a.name}  vs  ${cmp.b.name}`,
      stamp: win
        ? { text: `${win.name} 우세`, icon: "▲", color: "lime" }
        : { text: "막상막하", icon: "=", color: "muted" },
      badges: [
        { label: cmp.a.name, value: cmp.a.rating.toFixed(1), color: cmp.winner === "A" ? "lime" : "muted" },
        { label: "포지션", value: getPositionLabel(cmp.pos) },
        { label: cmp.b.name, value: cmp.b.rating.toFixed(1), color: cmp.winner === "B" ? "lime" : "muted" },
      ],
      footerUrl: "fclab",
    });
  } catch {
    return new Response("error", { status: 500 });
  }
}
