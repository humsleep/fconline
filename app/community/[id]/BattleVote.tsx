"use client";

import { useEffect, useState } from "react";

const VOTER_KEY = "fcscope-voter-id";
const PICK_KEY = (postId: string) => `fcscope-battle-pick-${postId}`;

function voterId(): string {
  try {
    let v = localStorage.getItem(VOTER_KEY);
    if (!v) {
      v = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      localStorage.setItem(VOTER_KEY, v);
    }
    return v;
  } catch {
    return "anon000000";
  }
}

/** 스쿼드 배틀 A/B 투표 위젯 — 익명(브라우저 id). 투표 후 결과 막대 표시. */
export default function BattleVote({ postId }: { postId: string }) {
  const [counts, setCounts] = useState<{ a: number; b: number } | null>(null);
  const [mine, setMine] = useState<"A" | "B" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const p = localStorage.getItem(PICK_KEY(postId));
      if (p === "A" || p === "B") setMine(p);
    } catch {
      // ignore
    }
    fetch(`/api/community/battle?postId=${encodeURIComponent(postId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCounts({ a: d.a ?? 0, b: d.b ?? 0 }))
      .catch(() => {});
  }, [postId]);

  const vote = async (pick: "A" | "B") => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/community/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, pick, voter: voterId() }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d) {
        setCounts({ a: d.a ?? 0, b: d.b ?? 0 });
        setMine(pick);
        try {
          localStorage.setItem(PICK_KEY(postId), pick);
        } catch {
          // ignore
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const total = counts ? counts.a + counts.b : 0;
  const aPct = total > 0 ? Math.round(((counts?.a ?? 0) / total) * 100) : 0;
  const bPct = total > 0 ? 100 - aPct : 0;

  return (
    <div className="mt-4">
      <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
        ⚔️ 어느 쪽이 더 나은가요?
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["A", "B"] as const).map((side) => {
          const picked = mine === side;
          const pct = side === "A" ? aPct : bPct;
          const n = side === "A" ? counts?.a ?? 0 : counts?.b ?? 0;
          return (
            <button
              key={side}
              onClick={() => vote(side)}
              disabled={busy}
              aria-pressed={picked}
              className={`relative overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-70 ${
                picked ? "border-accent" : "border-line hover:border-accent/50"
              }`}
            >
              {mine && (
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 ${side === "A" ? "bg-accent/15" : "bg-lose/15"}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between">
                <span className="scoreboard text-lg font-bold">
                  {side === "A" ? "🅰️ A팀" : "🅱️ B팀"}
                </span>
                {mine && (
                  <span className="scoreboard text-sm font-bold text-muted">
                    {pct}% <span className="text-[12px]">({n})</span>
                  </span>
                )}
              </span>
              {picked && (
                <span className="relative mt-1 block text-[12px] font-semibold text-accent">
                  ✓ 내 선택
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-muted">
        {mine
          ? `총 ${total}표 · 다시 눌러 바꿀 수 있어요`
          : "한쪽을 눌러 투표하면 결과가 보여요 (로그인 불필요)"}
      </p>
    </div>
  );
}
