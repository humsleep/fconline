import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";

// 스쿼드 배틀 A/B 투표 — 기존 vs_votes 테이블 재활용(service_role 전용).
// vs_key = `battle:{postId}`
// voter는 서버에서 파생: 로그인=계정 해시(1인 1표), 익명=IP+기기 해시
// (클라이언트가 voter를 임의 지정해 표를 찍어내는 조작 차단)

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

  // 도배 방지 — IP당 분당 15회 (투표 변경 여유는 충분)
  const ip = clientIp(req.headers);
  const rl = rateLimit(`battle:${ip}`, 15, 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: "잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );

  let body: { postId?: unknown; pick?: unknown; voter?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const vsKey = keyOf(String(body.postId ?? ""));
  const pick = body.pick === "A" || body.pick === "B" ? body.pick : null;
  if (!vsKey || !pick)
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  // voter 서버 파생 — 로그인이면 계정 기반(기기 무관 1인 1표)
  let voter: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user)
      voter = `u${createHash("sha256").update(`fcscope-vote:${user.id}`).digest("hex").slice(0, 32)}`;
  } catch {
    // Supabase 미설정 → 익명 경로
  }
  if (!voter) {
    // 익명: 기기 id(localStorage) + IP 해시 결합 — 기기 id만 바꾸는 조작은 IP가 묶고,
    // 공유 IP(CGNAT)의 서로 다른 사용자는 기기 id가 분리한다.
    const deviceId = String(body.voter ?? "").trim().slice(0, 64);
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(deviceId))
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    const ipPart = hashIp(ip) ?? "noip";
    voter = `a${createHash("sha256").update(`${ipPart}:${deviceId}`).digest("hex").slice(0, 32)}`;
  }

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
