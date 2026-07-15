import { getAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSquad } from "@/lib/squad/store";

export const dynamic = "force-dynamic";

/** 스쿼드 단건 조회 — 빌더 "불러와서 수정"용 (스쿼드는 공유 가능한 공개 데이터) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const squad = await getSquad(id);
  if (!squad) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(squad);
}

/** 스쿼드 삭제 — 로그인 + 본인(user_id) 소유만 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Supabase 미설정 → 아래 401
  }
  if (!userId)
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const db = getAdmin();
  if (!db) return Response.json({ error: "not configured" }, { status: 503 });

  const { data } = await db
    .from("squads")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  if (data.user_id !== userId)
    return Response.json(
      { error: "내가 저장한 스쿼드만 삭제할 수 있어요." },
      { status: 403 }
    );

  const { error } = await db.from("squads").delete().eq("id", id);
  if (error) return Response.json({ error: "delete failed" }, { status: 503 });
  return Response.json({ ok: true });
}
