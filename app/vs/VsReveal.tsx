"use client";

import { useEffect, useState } from "react";
import type { VsComparison, VoteCounts } from "@/lib/vs";
import ShareCardButton from "@/app/components/ShareCardButton";

const VOTER_KEY = "fclab_voter";
function getVoterId(): string {
  let id = localStorage.getItem(VOTER_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(VOTER_KEY, id);
  }
  return id;
}

export default function VsReveal({
  cmp,
  initialCounts,
}: {
  cmp: VsComparison;
  initialCounts: VoteCounts;
}) {
  const [revealed, setRevealed] = useState(false);
  const [counts, setCounts] = useState<VoteCounts>(initialCounts);
  const [myPick, setMyPick] = useState<"A" | "B" | null>(null);

  const storeKey = `fclab_vote_${cmp.vsKey}`;

  useEffect(() => {
    // 이미 투표한 대결이면 결과 바로 공개
    const prev = localStorage.getItem(storeKey);
    if (prev === "A" || prev === "B") {
      setMyPick(prev);
      setRevealed(true);
    }
  }, [storeKey]);

  async function vote(pick: "A" | "B") {
    // optimistic
    setMyPick(pick);
    setRevealed(true);
    setCounts((c) => ({
      a: c.a + (pick === "A" ? 1 : 0),
      b: c.b + (pick === "B" ? 1 : 0),
      total: c.total + 1,
    }));
    localStorage.setItem(storeKey, pick);
    try {
      const res = await fetch("/api/vs/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: cmp.vsKey, voter: getVoterId(), pick }),
      });
      if (res.ok) {
        const data: VoteCounts = await res.json();
        // 서버가 유효한 집계를 주면 반영, 0이면(미설정/장애) 낙관적 값 유지
        if (data.total > 0) setCounts(data);
      }
    } catch {
      // optimistic 값 유지
    }
  }

  const a = cmp.a!;
  const b = cmp.b!;
  const aPct = counts.total ? Math.round((counts.a / counts.total) * 100) : 0;
  const bPct = counts.total ? 100 - aPct : 0;
  const hit = myPick !== null && cmp.winner !== null && myPick === cmp.winner;

  if (!revealed) {
    return (
      <div className="mt-6">
        <p className="scoreboard text-center text-sm font-bold tracking-wide text-muted">
          누가 더 셀까? 예측해봐
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => vote("A")}
            aria-label={`${a.name}에 투표`}
            className="panel scoreboard truncate px-3 py-4 text-base font-bold transition-colors hover:border-accent/60 hover:text-accent"
          >
            {a.name}
          </button>
          <button
            onClick={() => vote("B")}
            aria-label={`${b.name}에 투표`}
            className="panel scoreboard truncate px-3 py-4 text-base font-bold transition-colors hover:border-accent/60 hover:text-accent"
          >
            {b.name}
          </button>
        </div>
        <button
          onClick={() => setRevealed(true)}
          className="mx-auto mt-3 block text-xs text-muted underline underline-offset-2 hover:text-ink"
        >
          그냥 결과만 볼래요
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6" role="status" aria-live="polite">
      {/* 판정 배너 */}
      {cmp.winner ? (
        <div className="panel rise flex items-center justify-center gap-2 px-4 py-3 text-center">
          <span className="scoreboard text-sm font-bold text-accent">
            {(cmp.winner === "A" ? a : b).name}
          </span>
          <span className="text-xs text-muted">우세</span>
          {hit && (
            <span className="scoreboard ml-2 rounded bg-gold/15 px-2 py-0.5 text-[13px] font-bold text-gold">
              🎯 안목 적중
            </span>
          )}
          {myPick && !hit && (
            <span className="ml-2 text-[13px] text-muted">아쉽!</span>
          )}
        </div>
      ) : (
        <div className="panel rise px-4 py-3 text-center text-sm font-bold text-muted">
          막상막하 — 우열을 가리기 어렵네요
        </div>
      )}

      {/* 스탯 비교 바 */}
      <div className="mt-4 space-y-3">
        {cmp.metrics.map((m) => (
          <VsBar
            key={m.label}
            label={m.label}
            a={m.a}
            b={m.b}
            max={m.max}
            unit={m.unit}
          />
        ))}
      </div>

      {/* 투표 결과 */}
      <div className="mt-5">
        <p className="scoreboard text-[13px] font-semibold text-muted">
          유저 예측 ({counts.total.toLocaleString()}표)
        </p>
        {/* A=라임, B=중립 슬레이트 — 우열이 아니라 '선택 비율' 표시 */}
        <div className="mt-1.5 flex h-7 overflow-hidden rounded-lg bg-surface-2 text-[13px] font-bold">
          <div
            className="flex items-center justify-start overflow-hidden bg-accent/80 px-2 text-accent-ink"
            style={{ width: `${aPct}%` }}
          >
            {aPct >= 12 && `${aPct}%`}
          </div>
          <div
            className="flex flex-1 items-center justify-end overflow-hidden bg-muted/40 px-2 text-ink"
          >
            {bPct >= 12 && `${bPct}%`}
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[13px] text-muted">
          <span className={myPick === "A" ? "text-accent" : ""}>
            {a.name}
            {myPick === "A" && " (내 선택)"}
          </span>
          <span className={myPick === "B" ? "text-accent" : ""}>
            {myPick === "B" && "(내 선택) "}
            {b.name}
          </span>
        </div>
      </div>

      {/* 카드 공유 */}
      <div className="mt-6 flex justify-center">
        <ShareCardButton
          url={`/api/card/vs?a=${a.spId}&b=${b.spId}&pos=${cmp.pos}`}
          filename={`fcscope-vs-${a.spId}-${b.spId}.png`}
          label="VS 카드 저장 · 공유"
        />
      </div>
    </div>
  );
}

function VsBar({
  label,
  a,
  b,
  max,
  unit,
}: {
  label: string;
  a: number;
  b: number;
  max: number;
  unit: string;
}) {
  const aWin = a >= b;
  const total = a + b || 1;
  const aShare = Math.round((a / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className={`scoreboard font-bold ${aWin ? "text-accent" : "text-muted"}`}>
          {aWin && "▲ "}
          {fmt(a)}
          {unit}
        </span>
        <span className="text-muted">{label}</span>
        <span className={`scoreboard font-bold ${!aWin ? "text-accent" : "text-muted"}`}>
          {fmt(b)}
          {unit}
          {!aWin && " ▲"}
        </span>
      </div>
      <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={aWin ? "bg-accent" : "bg-muted/40"}
          style={{
            width: `${aShare}%`,
            boxShadow: aWin ? "0 0 8px -2px var(--accent)" : undefined,
          }}
        />
        <div
          className={!aWin ? "bg-accent" : "bg-muted/40"}
          style={{
            width: `${100 - aShare}%`,
            boxShadow: !aWin ? "0 0 8px -2px var(--accent)" : undefined,
          }}
        />
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
