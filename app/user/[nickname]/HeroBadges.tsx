import Link from "next/link";
import { getRecentMatchDetails } from "@/lib/nexon/recent";
import { summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { computeMatchPerfStats, diagnoseMatchPerf } from "@/lib/match/diagnosis";
import { TONE_BG, TONE_TEXT } from "@/lib/diagnosis/tone";

/**
 * 성향 배지 — ⚽ 공식경기 유형.
 * "왜 이 유형인지" 설명을 함께 노출하고(모바일은 hover 툴팁이 없어 텍스트로), 탭하면 종합 리포트로 이동.
 *
 * 2026-09-04: 💰 이적시장 배지는 제거했다. 넥슨 `user/trade` 가 ouid 를 무시하고
 * API 키 소유자 본인의 거래만 반환해, 타인 닉네임에 붙일 수 있는 데이터가 아니었다.
 */
export default async function HeroBadges({
  ouid,
  nickname,
  cacheOnly = false,
}: {
  ouid: string;
  nickname: string;
  cacheOnly?: boolean;
}) {
  const recent = await getRecentMatchDetails(ouid, 50, 30, cacheOnly).catch(() => null);
  if (!recent) return null;

  const summaries = recent.details
    .map((d) => summarizeMatch(d, ouid))
    .filter((m): m is MatchSummary => m !== null);
  const matchType = diagnoseMatchPerf(computeMatchPerfStats(summaries)).type;
  if (!matchType) return null;

  return (
    <section className="mt-3">
      <Link
        href={`/user/${encodeURIComponent(nickname)}?type=50&view=report`}
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
    </section>
  );
}
