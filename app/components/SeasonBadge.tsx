"use client";

import { useState } from "react";

/**
 * 시즌(클래스) 배지 — 실제 시즌 로고 이미지 우선, 로드 실패 시 텍스트 폴백.
 * spid 앞 3자리 = seasonId 로 아이콘을 찾는다.
 */
export default function SeasonBadge({
  spid,
  season,
  size = "sm",
  className = "",
}: {
  spid: number;
  season?: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const seasonId = Math.floor(spid / 1_000_000);
  const label = season || `S${seasonId}`;
  const h = size === "xs" ? "h-3.5" : "h-4";

  if (broken) {
    return (
      <span
        className={`scoreboard rounded bg-gold/15 px-1 py-0.5 font-bold text-gold ${
          size === "xs" ? "text-[10px]" : "text-[11px]"
        } ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/season-image/${seasonId}`}
      alt={label}
      title={label}
      loading="lazy"
      draggable={false}
      onError={() => setBroken(true)}
      className={`${h} w-auto ${className}`}
    />
  );
}
