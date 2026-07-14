import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** KST 기준 오늘 (하루 1스냅샷) */
function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * 본인이 자기 전적을 볼 때 하루 1행 스냅샷 기록 → '지난 방문 대비' delta 재료.
 * 본인의 verified_nickname과 일치할 때만 기록(위·변조 방지). 비로그인/타인 = 조용히 무시.
 */
export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 200 });

  let body: { nickname?: unknown; winRate?: unknown; avgRating?: unknown; played?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const nickname = String(body.nickname ?? "").trim();
  const winRate = Math.round(Number(body.winRate));
  const avgRating = Number(body.avgRating);
  const played = Math.round(Number(body.played));
  if (
    !nickname ||
    !Number.isFinite(winRate) || winRate < 0 || winRate > 100 ||
    !Number.isFinite(avgRating) || avgRating < 0 || avgRating > 10 ||
    !Number.isFinite(played) || played <= 0
  )
    return NextResponse.json({ ok: false }, { status: 400 });

  // 내 연동 구단주명과 일치하는지 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("verified_nickname")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.verified_nickname || profile.verified_nickname !== nickname)
    return NextResponse.json({ ok: false }, { status: 200 });

  const db = getAdmin();
  if (!db) return NextResponse.json({ ok: false }, { status: 200 });
  try {
    await db.from("user_snapshots").upsert(
      {
        user_id: user.id,
        snapshot_date: kstToday(),
        win_rate: winRate,
        avg_rating: Math.round(avgRating * 100) / 100,
        played,
      },
      { onConflict: "user_id,snapshot_date" }
    );
  } catch {
    // 기록 실패는 조용히
  }
  return NextResponse.json({ ok: true });
}
