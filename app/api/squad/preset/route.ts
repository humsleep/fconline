import { resolvePreset } from "@/lib/squad/store";

export const dynamic = "force-dynamic";

// 팀 프리셋 → 슬롯 채우기 (이름을 spid로 해석)
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-z0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const resolved = await resolvePreset(id);
  if (!resolved) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(resolved);
}
