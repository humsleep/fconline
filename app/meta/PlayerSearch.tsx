"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Hit {
  spid: number;
  name: string;
  season: string;
}

/** 선수 이름 검색 → 선수 도감(/player/[spid]). players/search API(빌더와 공용) 재사용. */
export default function PlayerSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 1) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const d = await res.json();
        setHits((d.players ?? []).slice(0, 8));
        setOpen(true);
      } catch {
        // 무시
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative mt-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder="선수 이름으로 도감 검색 (예: 손흥민)"
        aria-label="선수 검색"
        className="input-search h-11 w-full px-3 text-sm"
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
          {hits.map((h) => (
            <li key={h.spid}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/player/${h.spid}`);
                }}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{h.name}</span>
                {h.season && (
                  <span className="scoreboard flex-none rounded bg-gold/15 px-1.5 py-0.5 text-[12px] font-bold text-gold">
                    {h.season}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
