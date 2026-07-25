"use client";

import { useEffect, useState } from "react";
import { isFavorite, toggleFavorite } from "@/lib/client/local-prefs";

/** 구단주 즐겨찾기 토글 (localStorage) — 홈 대시보드 워치리스트에 노출. */
export default function FavoriteButton({ nickname }: { nickname: string }) {
  const [fav, setFav] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFav(isFavorite(nickname));
    setReady(true);
  }, [nickname]);

  function onClick() {
    const next = toggleFavorite(nickname);
    setFav(next.some((n) => n.toLowerCase() === nickname.toLowerCase()));
  }

  return (
    <button
      onClick={onClick}
      disabled={!ready}
      aria-pressed={fav}
      aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기"}
      className={`scoreboard inline-flex min-h-11 flex-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors ${
        fav
          ? "bg-gold/15 text-gold hover:bg-gold/25"
          : "bg-surface-2 text-ink hover:bg-line"
      } ${ready ? "" : "opacity-0"}`}
    >
      <span aria-hidden>{fav ? "★" : "☆"}</span>
      {fav ? "즐겨찾기됨" : "즐겨찾기"}
    </button>
  );
}
