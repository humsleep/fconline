"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/supabase/useUser";

/**
 * 로그인 사용자가 '본인 전적'을 볼 때 하루 1스냅샷을 서버에 기록(fire-and-forget).
 * 서버가 verified_nickname 일치를 재확인하므로 타인/비로그인은 무해하게 무시된다.
 * 렌더 결과 없음.
 */
export default function VisitRecorder({
  nickname,
  winRate,
  avgRating,
  played,
}: {
  nickname: string;
  winRate: number;
  avgRating: number;
  played: number;
}) {
  const { user } = useUser();

  useEffect(() => {
    if (!user || played <= 0) return;
    fetch("/api/me/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, winRate, avgRating, played }),
    }).catch(() => {});
  }, [user, nickname, winRate, avgRating, played]);

  return null;
}
