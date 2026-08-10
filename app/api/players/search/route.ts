import { searchPlayers } from "@/lib/nexon/players";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// 스쿼드 빌더 선수 검색 (spid.json 메모이즈 조회 — 넥슨 API 호출 아님).
// 매 호출이 2MB+ 인덱스를 필터·정렬하는 순수 CPU라, 임의 q 폭주가 인스턴스 CPU를
// 태울 수 있다 → ①IP rate limit ②q 최소 2자(1자는 매칭 폭발+캐시 무의미) ③결과 cap(24).
export async function GET(req: Request) {
  const rl = limitNexonFanout(req.headers, "search");
  if (!rl.ok)
    return Response.json(
      { players: [] },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return Response.json({ players: [] });
  const players = await searchPlayers(q, 24);
  return Response.json(
    { players },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
