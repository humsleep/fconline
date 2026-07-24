import { revalidatePath } from "next/cache";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * 전적 갱신 (op.gg식) — 해당 구단주 페이지의 캐시를 만료시켜 다음 렌더에서 넥슨 최신 조회.
 * 매치 상세는 불변이라 영구 캐시 유지되고, 변하는 매치 목록·기본정보·등급만 새로 받는다.
 * 남용 방지: 프로필당 20초 1회 + IP당 분당 15회 (둘 중 하나라도 걸리면 429).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ nickname: string }> }
) {
  const { nickname } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(nickname);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const ip = clientIp(req.headers);
  const perProfile = rateLimit(`refresh:${decoded.toLowerCase()}`, 1, 20_000);
  const perIp = rateLimit(`refresh-ip:${ip}`, 15, 60_000);
  if (!perProfile.ok || !perIp.ok) {
    const retryAfter = Math.max(perProfile.retryAfter, perIp.retryAfter);
    return new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  // 브라우저가 요청한 경로와 동일한 인코딩으로 무효화 (전적·이적시장 둘 다)
  const enc = encodeURIComponent(decoded);
  revalidatePath(`/user/${enc}`);
  revalidatePath(`/market/${enc}`);

  return Response.json({ ok: true });
}
