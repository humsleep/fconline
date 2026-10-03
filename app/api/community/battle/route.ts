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
  // 전체 투표 행을 가져와 JS로 세지 않고 head 카운트 2개로 집계 —
  // 행 payload 전송 없이 vs_key 인덱스만 타서 IO/전송량을 줄인다(인기글일수록 이득).
  const [ra, rb] = await Promise.all([
    db
      .from("vs_votes")
      .select("*", { count: "exact", head: true })
      .eq("vs_key", vsKey)
      .eq("pick", "A"),
    db
      .from("vs_votes")
      .select("*", { count: "exact", head: true })
      .eq("vs_key", vsKey)
      .eq("pick", "B"),
  ]);
  return { a: ra.count ?? 0, b: rb.count ?? 0 };
}

/**
 * 투표자 키 서버 파생 — 로그인이면 계정 기반(기기 무관 1인 1표),
 * 아니면 기기 id(앱/웹이 보내는 voter) + IP 해시. 기기 id 가 없거나 형식이 틀리면 null.
 */
async function deriveVoter(req: Request, deviceRaw: unknown): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user)
      return `u${createHash("sha256").update(`fcscope-vote:${user.id}`).digest("hex").slice(0, 32)}`;
  } catch {
    // Supabase 미설정 → 익명 경로
  }
  // 익명: 기기 id(localStorage) + IP 해시 결합 — 기기 id만 바꾸는 조작은 IP가 묶고,
  // 공유 IP(CGNAT)의 서로 다른 사용자는 기기 id가 분리한다.
  const deviceId = String(deviceRaw ?? "").trim().slice(0, 64);
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(deviceId)) return null;
  const ipPart = hashIp(clientIp(req.headers)) ?? "noip";
  return `a${createHash("sha256").update(`${ipPart}:${deviceId}`).digest("hex").slice(0, 32)}`;
}

async function myPick(vsKey: string, voter: string): Promise<"A" | "B" | null> {
  const db = getAdmin();
  if (!db) return null;
  try {
    const { data } = await db
      .from("vs_votes")
      .select("pick")
      .eq("vs_key", vsKey)
      .eq("voter", voter)
      .maybeSingle();
    const p = (data as { pick?: string } | null)?.pick;
    return p === "A" || p === "B" ? p : null;
  } catch {
    return null;
  }
}

/**
 * GET ?postId=&voter= — `{ a, b, mine }`.
 * mine(v2 추가) = 이 요청자가 고른 쪽("A"/"B") 또는 null. 로그인(Bearer/쿠키)이면 계정 기준,
 * 아니면 voter(기기 id)를 함께 보낼 때만 계산한다. 개인화 응답이라 그때는 공유 캐시를 끈다.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const vsKey = keyOf(sp.get("postId") ?? "");
  if (!vsKey) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const personal =
    Boolean(req.headers.get("authorization")) ||
    Boolean(req.headers.get("cookie")?.includes("auth-token")) ||
    Boolean(sp.get("voter"));
  if (!personal) {
    // 짧은 edge 캐시 — 인기글에서 GET이 매 조회마다 DB를 치지 않게(≤10s 지연 허용).
    return NextResponse.json(
      { ...(await counts(vsKey)), mine: null },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
    );
  }
  const voter = await deriveVoter(req, sp.get("voter"));
  const [c, mine] = await Promise.all([counts(vsKey), voter ? myPick(vsKey, voter) : Promise.resolve(null)]);
  return NextResponse.json({ ...c, mine }, { headers: { "Cache-Control": "private, no-store" } });
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

  const voter = await deriveVoter(req, body.voter);
  if (!voter) return NextResponse.json({ error: "invalid" }, { status: 400 });

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
  return NextResponse.json({ ...(await counts(vsKey)), mine: pick });
}
