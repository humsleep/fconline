import Link from "next/link";
import { getRecentSearches } from "@/lib/search-log";

/**
 * 홈 "지금 검색되는 구단주" — 최근 검색 닉네임을 클릭 가능한 칩으로.
 * 빈 검색창보다 사이트가 살아있어 보이게 해 첫 방문 검색 전환↑ + 다른 사람 전적 구경 유도.
 * 데이터 없으면 렌더 안 함(신규/콜드 상태에서 빈 섹션 방지). 홈 ISR(1h)이라 부하 무시 가능.
 */
export default async function RecentSearches() {
  const names = await getRecentSearches(12);
  if (names.length < 3) return null; // 표본 적으면 어색 → 숨김

  return (
    <section className="rise rise-3 relative mt-6 w-full max-w-md text-left">
      <p className="scoreboard text-[12px] font-bold tracking-[0.2em] text-muted">
        🔎 지금 검색되는 구단주
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {names.map((n) => (
          <Link
            key={n}
            href={`/user/${encodeURIComponent(n)}`}
            className="scoreboard inline-flex min-h-9 max-w-[10rem] items-center truncate rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-accent hover:text-accent-ink"
          >
            {n}
          </Link>
        ))}
      </div>
    </section>
  );
}
