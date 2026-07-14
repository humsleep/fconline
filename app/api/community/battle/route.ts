import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase/admin";

// 스쿼드 배틀 A/B 투표 — 기존 vs_votes 테이블 재활용(익명 voter, service_role 전용).
// vs_key = `battle:{postId}`

function keyOf(postId: string): string | null {
  if (!/^[a-zA-Z0-9]{1,32}$/.test(postId)) return null;
  return `battle:${postId}`;
}

async function counts(vsKey: string): Promise<{ a: number; b: number }> {
  const db = getAdmin();
  if (!db) return { a: 0, b: 0 };
  const { data } = await db.from("vs_votes").select("pick").eq("vs_key", vsKey);
  let a = 0;
  let b = 0;
  for (const r of data ?? []) {
    if (r.pick === "A") a++;
    else if (r.pick === "B") b++;
  }
  return { a, b };
}

export async function GET(req: Request) {
  const postId = new URL(req.url).searchParams.get("postId") ?? "";
  const vsKey = keyOf(postId);
  if (!vsKey) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json(await counts(vsKey));
}

export async function POST(req: Request) {
  const db = getAdmin();
  if (!db) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  let body: { postId?: unknown; pick?: unknown; voter?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const vsKey = keyOf(String(body.postId ?? ""));
  const pick = body.pick === "A" || body.pick === "B" ? body.pick : null;
  const voter = String(body.voter ?? "").trim().slice(0, 64);
  if (!vsKey || !pick || !/^[a-zA-Z0-9_-]{6,64}$/.test(voter))
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    await db
      .from("vs_votes")
      .upsert(
        { vs_key: vsKey, voter, pick, created_at: new Date().toISOString() },
        { onConflict: "vs_key,voter" }
      );
  } catch {
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
  return NextResponse.json(await counts(vsKey));
}
