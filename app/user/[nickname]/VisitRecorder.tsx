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
    // 서버는 (user_id, 날짜) 하루 1행 upsert 라 여러 번 보내도 결과가 같지만,
    // 매 페이지 로드마다 인증 확인 + 프로필 조회 + 쓰기가 발생한다.
    // 같은 날 이미 보냈으면 클라이언트에서 끊는다(KST 기준 날짜 키).
    const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    const key = `fcscope-snapshot-${nickname.toLowerCase()}`;
    try {
      if (localStorage.getItem(key) === day) return;
    } catch {
      // 프라이빗 모드 등 — 스로틀 없이 진행
    }
    fetch("/api/me/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, winRate, avgRating, played }),
    })
      .then((r) => {
        if (r.ok) {
          try {
            localStorage.setItem(key, day);
          } catch {
            // 무시
          }
        }
      })
      .catch(() => {});
  }, [user, nickname, winRate, avgRating, played]);

  return null;
}
