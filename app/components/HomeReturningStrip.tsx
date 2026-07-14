"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const RECENT_KEY = "fcscope-recent-searches";

interface Snapshot {
  winRate: number;
  deltaWinRate: number | null;
}
interface ProfileResp {
  profile: { nickname: string | null; verified_nickname: string | null } | null;
  squads?: { id: string }[];
  snapshot?: Snapshot | null;
}

/**
 * 홈 상단 재방문/로그인 개인화 스트립. 비로그인이거나 데이터 없으면 아무것도 렌더하지 않음
 * → 첫 방문자 히어로는 그대로, 재방문자만 대시보드로 맞이한다.
 */
export default function HomeReturningStrip() {
  const [data, setData] = useState<ProfileResp | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      if (Array.isArray(raw)) setRecent(raw.filter((x) => typeof x === "string").slice(0, 5));
    } catch {
      // ignore
    }
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  const profile = data?.profile ?? null;
  // 로그인(닉네임 보유)이 아니면 스트립 미표시 — 비로그인 첫인상은 히어로 그대로
  if (!profile?.nickname) return null;

  const snap = data?.snapshot ?? null;
  const squadCount = data?.squads?.length ?? 0;

  return (
    <section className="panel rise mt-2 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-base font-bold">
          다시 오셨네요, <span className="text-accent">{profile.nickname}</span>님 👋
        </p>
        {snap && snap.deltaWinRate !== null && (
          <span
            className={`scoreboard rounded-lg px-2 py-1 text-sm font-bold ${
              snap.deltaWinRate > 0
                ? "bg-win/15 text-win"
                : snap.deltaWinRate < 0
                  ? "bg-lose/15 text-lose"
                  : "bg-surface-2 text-muted"
            }`}
          >
            지난 방문 대비 승률{" "}
            {snap.deltaWinRate > 0
              ? `▲${snap.deltaWinRate}%p`
              : snap.deltaWinRate < 0
                ? `▼${-snap.deltaWinRate}%p`
                : "±0"}
          </span>
        )}
      </div>

      {/* 바로가기 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {profile.verified_nickname && (
          <Link
            href={`/user/${encodeURIComponent(profile.verified_nickname)}`}
            className="scoreboard rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-ink"
          >
            ⚽ 내 전적·분석
          </Link>
        )}
        <Link
          href="/me"
          className="scoreboard rounded-lg bg-surface-2 px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-line"
        >
          🏠 마이페이지{squadCount > 0 ? ` · 스쿼드 ${squadCount}` : ""}
        </Link>
      </div>

      {/* 최근 검색 */}
      {recent.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted">최근 검색</span>
          {recent.map((r) => (
            <Link
              key={r}
              href={`/user/${encodeURIComponent(r)}`}
              className="scoreboard rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line"
            >
              {r}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
