"use client";

import { useEffect, useState } from "react";

interface StatData {
  matchCount: number;
  spRating: number;
  goal: number;
  assist: number;
  shoot: number;
  effectiveShoot: number;
  passTry: number;
  passSuccess: number;
  dribbleTry: number;
  dribbleSuccess: number;
  tackle: number;
  intercept: number;
  block: number;
}

// spid×pos별 결과 캐시 — 같은 세션에서 재선택 시 재요청 방지 (null = 데이터 없음)
const cache = new Map<string, StatData | null>();

function pct(success: number, tryCount: number): string {
  return tryCount > 0 ? `${Math.round((success / tryCount) * 100)}%` : "–";
}
function avg(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/**
 * 배치된 선수의 랭커 평균 실전 스탯 (공식경기).
 * 카드 오버롤·상세 능력치·고유 특성은 넥슨 공식 API 미제공이라
 * 이 카드를 실제로 쓴 랭커들의 경기당 평균 기록으로 대신 보여준다.
 */
export default function RankerStatPanel({
  spid,
  pos,
  name,
}: {
  spid: number;
  pos: string;
  name: string;
}) {
  const [state, setState] = useState<"loading" | "none" | "ready">("loading");
  const [stat, setStat] = useState<StatData | null>(null);

  useEffect(() => {
    const key = `${spid}:${pos}`;
    if (cache.has(key)) {
      const c = cache.get(key) ?? null;
      setStat(c);
      setState(c ? "ready" : "none");
      return;
    }
    let alive = true;
    setState("loading");
    fetch(`/api/players/ranker-stat?spid=${spid}&pos=${encodeURIComponent(pos)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const s: StatData | null = d?.found ? d.stat : null;
        cache.set(key, s);
        setStat(s);
        setState(s ? "ready" : "none");
      })
      .catch(() => {
        if (alive) setState("none"); // 실패는 캐시하지 않음 — 재선택 시 재시도
      });
    return () => {
      alive = false;
    };
  }, [spid, pos]);

  return (
    <div className="mx-auto mt-2 max-w-md rounded-lg bg-surface-2/70 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="scoreboard text-[12px] font-bold tracking-[0.15em] text-muted">
          랭커 실전 스탯
        </span>
        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
        <span className="scoreboard flex-none text-[12px] font-bold text-muted">
          {pos}
        </span>
        {state === "ready" && stat && (
          <span className="scoreboard ml-auto flex-none rounded bg-gold/15 px-1.5 py-0.5 text-[13px] font-bold text-gold">
            평점 {stat.spRating.toFixed(2)}
          </span>
        )}
      </div>

      {state === "loading" && (
        <p className="mt-1.5 text-[13px] text-muted">랭커 스탯 불러오는 중…</p>
      )}
      {state === "none" && (
        <p className="mt-1.5 text-[13px] text-muted">
          이 카드의 {pos} 포지션 랭커 실전 데이터가 아직 없어요.
        </p>
      )}
      {state === "ready" && stat && (
        <>
          <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            {[
              ["골", avg(stat.goal)],
              ["도움", avg(stat.assist)],
              ["슛 (유효)", `${avg(stat.shoot)} (${avg(stat.effectiveShoot)})`],
              ["패스 성공", pct(stat.passSuccess, stat.passTry)],
              ["드리블 성공", pct(stat.dribbleSuccess, stat.dribbleTry)],
              ["태클·인터셉트", `${avg(stat.tackle)}·${avg(stat.intercept)}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded bg-surface px-1 py-1.5">
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="scoreboard mt-0.5 text-sm font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1.5 text-[12px] text-muted">
            이 카드를 쓴 랭커들의 경기당 평균 (공식경기 · 표본 {stat.matchCount}
            경기). 카드 오버롤·고유 특성은 공식 API 미제공.
          </p>
        </>
      )}
    </div>
  );
}
