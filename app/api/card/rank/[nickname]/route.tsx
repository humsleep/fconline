import { getMaxDivisions, getOuid } from "@/lib/nexon/api";
import { getDivisionName, getMatchTypeName, divisionTierColor } from "@/lib/nexon/meta";
import { renderCard } from "@/lib/card/render";
import { formatAchievementDate } from "@/lib/format";
import { limitNexonFanout } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 계급 인증 카드 — 이미 조회하는 maxdivision을 주역으로. 디시 '계급 인증글' 바이럴 포맷. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ nickname: string }> }
) {
  // 넥슨 조회 유발 — 형제 카드 라우트와 동일 IP rate limit (임의 닉 반복 조회 방어)
  const rl = limitNexonFanout(req.headers, "card");
  if (!rl.ok)
    return new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });

  const { nickname } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(nickname);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  try {
    const ouid = await getOuid(decoded);
    const divisions = await getMaxDivisions(ouid).catch(() => []);
    if (divisions.length === 0) return new Response("no rank", { status: 404 });

    // 공식경기(50) 우선, 없으면 가장 상위(작은 division) 대표
    const official =
      divisions.find((d) => d.matchType === 50) ??
      [...divisions].sort((a, b) => a.division - b.division)[0];

    const repName = await getDivisionName(official.division);
    const repType = await getMatchTypeName(official.matchType);
    const color = divisionTierColor(official.division);

    const others = divisions.filter((d) => d !== official).slice(0, 3);
    const badges = await Promise.all(
      others.map(async (d) => ({
        label: await getMatchTypeName(d.matchType),
        value: await getDivisionName(d.division),
        color: divisionTierColor(d.division),
      }))
    );

    return renderCard({
      kicker: `${repType} 최고 등급`,
      title: repName,
      subtitle: `${decoded}`,
      stamp: {
        text: `달성 ${formatAchievementDate(official.achievementDate)}`,
        icon: "",
        color,
      },
      badges,
      footerUrl: "fcscope",
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
