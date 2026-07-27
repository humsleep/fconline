"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFavorites, recordVisit, type Streak } from "@/lib/client/local-prefs";

/**
 * 홈 개인화 대시보드 (로그인 불필요, localStorage 기반) — 방문 스트릭 + 즐겨찾기 구단주.
 * 마운트 시 오늘 방문을 기록해 "N일 연속" 스트릭을 키운다(재방문 훅).
 * 데이터가 없는 신규 방문자에겐 아무것도 렌더하지 않아 첫 화면을 어지럽히지 않음.
 */
export default function HomeDashboard() {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => {
    setStreak(recordVisit());
    setFavs(getFavorites());
  }, []);

  const showStreak = streak && streak.current >= 2;
  const showFavs = favs.length > 0;
  if (!showStreak && !showFavs) return null;

  return (
    <div className="rise rise-3 relative mt-5 w-full max-w-md space-y-2 text-left">
      {showStreak && (
        <div className="panel flex items-center gap-2 px-4 py-2.5">
          <span aria-hidden className="text-lg">🔥</span>
          <p className="text-sm font-semibold">
            <span className="text-accent">{streak!.current}일</span> 연속 방문 중
            {streak!.best > streak!.current && (
              <span className="ml-1.5 text-[13px] font-normal text-muted">
                최고 {streak!.best}일
              </span>
            )}
          </p>
        </div>
      )}
      {showFavs && (
        <div className="panel px-4 py-3">
          <p className="scoreboard text-[12px] font-bold tracking-[0.2em] text-muted">
            ⭐ 즐겨찾기 구단주
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {favs.map((n) => (
              <Link
                key={n}
                href={`/user/${encodeURIComponent(n)}`}
                className="scoreboard inline-flex min-h-11 max-w-[10rem] items-center truncate rounded-full bg-surface-2 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent hover:text-accent-ink"
              >
                {n}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
