import { searchPlayers } from "@/lib/nexon/players";

export const dynamic = "force-dynamic";

// 스쿼드 빌더 선수 검색 (spid.json 메모이즈 조회 — 넥슨 API 호출 아님)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 1) return Response.json({ players: [] });
  const players = await searchPlayers(q, 24);
  return Response.json(
    { players },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
