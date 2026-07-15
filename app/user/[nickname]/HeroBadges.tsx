import Link from "next/link";
import { getUserTrades } from "@/lib/nexon/api";
import { getRecentMatchDetails } from "@/lib/nexon/recent";
import { summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { computeMarketStats, diagnoseMarket } from "@/lib/market/diagnosis";
import { computeMatchPerfStats, diagnoseMatchPerf } from "@/lib/match/diagnosis";
import { TONE_BG, TONE_TEXT } from "@/lib/diagnosis/tone";

/**
 * 히어로 우측 성향 배지 — ⚽ 공식경기 유형 + 💰 이적시장 유형.
 * 각 배지는 상세(분석 탭 / 이적시장 페이지)로 연결. 데이터 없으면 해당 배지 생략.
 */
export default async function HeroBadges({
  ouid,
  nickname,
}: {
  ouid: string;
  nickname: string;
}) {
  const [buy, sell, recent] = await Promise.all([
    getUserTrades(ouid, "buy", 40).catch(() => null),
    getUserTrades(ouid, "sell", 40).catch(() => null),
    getRecentMatchDetails(ouid, 50, 30).catch(() => null),
  ]);

  const marketType =
    buy || sell
      ? diagnoseMarket(computeMarketStats(buy ?? [], sell ?? [])).type
      : null;

  let matchType = null;
  if (recent) {
    const summaries = recent.details
      .map((d) => summarizeMatch(d, ouid))
      .filter((m): m is MatchSummary => m !== null);
    matchType = diagnoseMatchPerf(computeMatchPerfStats(summaries)).type;
  }

  if (!marketType && !matchType) return null;

  const enc = encodeURIComponent(nickname);
  // 세로 스택 — 히어로 우측 공백을 활용해 한 칸에 하나씩
  return (
    <div className="flex flex-col items-end gap-1.5">
      {matchType && (
        <Link
          href={`/user/${enc}?type=50&view=report`}
          title={matchType.desc}
          className={`scoreboard whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-bold transition-opacity hover:opacity-80 sm:px-3 sm:text-sm ${TONE_BG[matchType.tone]} ${TONE_TEXT[matchType.tone]}`}
        >
          ⚽ {matchType.title}
        </Link>
      )}
      {marketType && (
        <Link
          href={`/market/${enc}`}
          title={marketType.desc}
          className={`scoreboard whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-bold transition-opacity hover:opacity-80 sm:px-3 sm:text-sm ${TONE_BG[marketType.tone]} ${TONE_TEXT[marketType.tone]}`}
        >
          💰 {marketType.title}
        </Link>
      )}
    </div>
  );
}
