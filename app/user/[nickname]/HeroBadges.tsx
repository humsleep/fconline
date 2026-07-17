import Link from "next/link";
import { getUserTrades } from "@/lib/nexon/api";
import { getRecentMatchDetails } from "@/lib/nexon/recent";
import { summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { computeMarketStats, diagnoseMarket } from "@/lib/market/diagnosis";
import { computeMatchPerfStats, diagnoseMatchPerf } from "@/lib/match/diagnosis";
import { TONE_BG, TONE_TEXT } from "@/lib/diagnosis/tone";

/**
 * 성향 배지 — ⚽ 공식경기 유형 + 💰 이적시장 유형.
 * 각 배지는 "왜 이 유형인지" 설명을 함께 노출(모바일은 hover 툴팁이 없어 텍스트로 표시)하고,
 * 탭하면 상세 진단(분석 탭 / 이적시장)으로 이동. 데이터 없으면 해당 배지 생략.
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

  // buy/sell 중 하나만 실패(429/장애)하면 한쪽이 null → 예: 매입만 실패 시
  // "무지출 셀러"로 확신에 찬 오답 라벨이 뜬다. 두 피드가 모두 있을 때만 진단.
  const marketType =
    buy && sell ? diagnoseMarket(computeMarketStats(buy, sell)).type : null;

  let matchType = null;
  if (recent) {
    const summaries = recent.details
      .map((d) => summarizeMatch(d, ouid))
      .filter((m): m is MatchSummary => m !== null);
    matchType = diagnoseMatchPerf(computeMatchPerfStats(summaries)).type;
  }

  if (!marketType && !matchType) return null;

  const enc = encodeURIComponent(nickname);
  return (
    <section className="mt-3 grid gap-2 sm:grid-cols-2">
      {matchType && (
        <Link
          href={`/user/${enc}?type=50&view=report`}
          className="panel flex items-start gap-2.5 p-3 transition-colors hover:border-accent/50"
        >
          <span
            className={`scoreboard mt-0.5 flex-none whitespace-nowrap rounded-lg px-2.5 py-1 text-[13px] font-bold ${TONE_BG[matchType.tone]} ${TONE_TEXT[matchType.tone]}`}
          >
            ⚽ {matchType.title}
          </span>
          <span className="min-w-0 text-[13px] leading-relaxed text-muted">
            {matchType.desc}
          </span>
        </Link>
      )}
      {marketType && (
        <Link
          href={`/market/${enc}`}
          className="panel flex items-start gap-2.5 p-3 transition-colors hover:border-accent/50"
        >
          <span
            className={`scoreboard mt-0.5 flex-none whitespace-nowrap rounded-lg px-2.5 py-1 text-[13px] font-bold ${TONE_BG[marketType.tone]} ${TONE_TEXT[marketType.tone]}`}
          >
            💰 {marketType.title}
          </span>
          <span className="min-w-0 text-[13px] leading-relaxed text-muted">
            {marketType.desc}
          </span>
        </Link>
      )}
    </section>
  );
}
