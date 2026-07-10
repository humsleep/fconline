import { getMatchDetailCached } from "@/lib/nexon/cached";
import { getMatchTypeName } from "@/lib/nexon/meta";
import { verdictFromMatch } from "@/lib/verdict";
import { renderCard } from "@/lib/card/render";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const me = new URL(req.url).searchParams.get("me") ?? undefined;

  try {
    const detail = await getMatchDetailCached(matchId);
    const info = detail.matchInfo ?? [];
    if (info.length === 0) return new Response("no data", { status: 404 });

    const mine = info.find((e) => e.ouid === me) ?? info[0];
    const opp = info.find((e) => e !== mine) ?? null;
    const myGoals = mine.shoot?.goalTotalDisplay ?? mine.shoot?.goalTotal ?? 0;
    const oppGoals = opp
      ? opp.shoot?.goalTotalDisplay ?? opp.shoot?.goalTotal ?? 0
      : 0;

    const v = verdictFromMatch({
      result: mine.matchDetail?.matchResult ?? "?",
      myRating: mine.matchDetail?.averageRating ?? 0,
      seed: detail.matchId,
    });
    const typeName = await getMatchTypeName(detail.matchType);

    return renderCard({
      kicker: `${typeName} 리포트`,
      title: `${myGoals} : ${oppGoals}`,
      subtitle: `${mine.nickname} · ${v.label}`,
      stamp: { text: v.oneLiner, icon: v.icon, color: v.color },
      badges: [
        { label: "점유율", value: `${mine.matchDetail?.possession ?? 0}%` },
        { label: "유효슛", value: `${mine.shoot?.effectiveShootTotal ?? 0}` },
        {
          label: "평점",
          value: (mine.matchDetail?.averageRating ?? 0).toFixed(1),
          color: v.color,
        },
      ],
      footerUrl: "fclab",
    });
  } catch {
    return new Response("error", { status: 500 });
  }
}
