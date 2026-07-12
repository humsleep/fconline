"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MatchSummary } from "@/lib/nexon/summary";
import { formatMatchDate } from "@/lib/format";

// 폴링 간격은 match-list revalidate(60s)보다 크게 두어 재검증 경계 중첩을 완화
const POLL_MS = 75_000;

// 하드 오류(대기해도 안 풀림)만 전체 오류 화면. 그 외는 일시 오류로 마지막 데이터 유지.
type HardError = "not_found" | "not_configured";

interface ApiResp {
  ok: boolean;
  ouid?: string;
  matches?: MatchSummary[];
  listOk?: boolean; // 매치리스트 조회 성공 여부(빈 목록과 조회실패 구분)
  reason?: string;
}

export default function LiveSession({
  nickname,
  matchType,
}: {
  nickname: string;
  matchType: number;
}) {
  const [hardError, setHardError] = useState<HardError | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [ouid, setOuid] = useState<string>("");
  const [latest, setLatest] = useState<MatchSummary | null>(null);
  const [sessionMatches, setSessionMatches] = useState<MatchSummary[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // 세션 시작 시점에 이미 있던 경기 = 기준선(세션 제외). 이후 등장분만 세션.
  const baselineRef = useRef<Set<string> | null>(null);
  const seenRef = useRef<Map<string, MatchSummary>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const poll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(
        `/api/live/${encodeURIComponent(nickname)}?type=${matchType}`,
        { cache: "no-store", signal: ac.signal }
      );
      const data: ApiResp = await res.json();

      if (!data.ok) {
        // 하드 오류만 전체 오류 화면. 점검/일시오류는 마지막 데이터 유지 + 재연결 표시.
        if (data.reason === "not_found") setHardError("not_found");
        else if (data.reason === "not_configured") setHardError("not_configured");
        else setReconnecting(true);
        return;
      }

      setReconnecting(false);
      if (data.ouid) setOuid(data.ouid);
      const matches = data.matches ?? [];
      setLastChecked(new Date());

      // 기준선 확정은 "매치리스트 조회 성공" 후에만 (빈 첫 응답이 조회실패면 대기)
      if (baselineRef.current === null) {
        if (!data.listOk) {
          setLatest((prev) => matches[0] ?? prev);
          return; // 아직 기준선 미확정 — 다음 성공 폴링까지 대기
        }
        baselineRef.current = new Set(matches.map((m) => m.matchId));
        setLatest(matches[0] ?? null);
        return;
      }

      if (matches[0]) setLatest(matches[0]);

      // 기준선 이후 새로 등장한 경기 = 세션 경기
      let grew = false;
      for (const m of matches) {
        if (baselineRef.current.has(m.matchId)) continue;
        if (!seenRef.current.has(m.matchId)) {
          seenRef.current.set(m.matchId, m);
          grew = true;
        }
      }
      if (grew) {
        const merged = [...seenRef.current.values()].sort(
          (a, b) => dateVal(b.matchDate) - dateVal(a.matchDate)
        );
        setSessionMatches(merged);
        setFlashId(merged[0]?.matchId ?? null);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setReconnecting(true);
    }
  }, [nickname, matchType]);

  useEffect(() => {
    poll();
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") poll();
      }, POLL_MS);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        poll();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      abortRef.current?.abort();
    };
  }, [poll]);

  if (hardError) {
    return <LiveError status={hardError} nickname={nickname} />;
  }

  const rec = aggregate(sessionMatches);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8">
      {/* 라이브 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-lose" />
          <span className="sr-only">실시간 분석 중</span>
          <span className="scoreboard text-sm font-bold tracking-wide">
            LIVE · {nickname}
          </span>
        </div>
        <span className="text-sm text-muted" aria-live="polite">
          {reconnecting
            ? "재연결 중…"
            : !lastChecked
              ? "연결 중…"
              : `${timeAgo(lastChecked)} 갱신 · 75초마다 자동`}
        </span>
      </div>

      {/* 세션 대시보드 */}
      <section className="panel mt-4 px-5 py-4" aria-live="polite">
        <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
          이번 세션 (켠 뒤부터)
        </p>
        {sessionMatches.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            대기 중 — 경기를 한 판 끝내면 여기에 자동으로 분석이 올라옵니다.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="scoreboard text-3xl font-bold">
                <span className="text-win">{rec.win}</span>
                <span className="mx-1 text-muted">-</span>
                <span className="text-draw">{rec.draw}</span>
                <span className="mx-1 text-muted">-</span>
                <span className="text-lose">{rec.lose}</span>
              </p>
              <p className="text-[13px] text-muted">세션 전적</p>
            </div>
            {rec.streak !== 0 && (
              <div>
                <p
                  className={`scoreboard text-2xl font-bold ${
                    rec.streak > 0 ? "text-win" : "text-lose"
                  }`}
                >
                  {Math.abs(rec.streak)}
                  {rec.streak > 0 ? "연승" : "연패"}
                </p>
                <p className="text-[13px] text-muted">현재 흐름</p>
              </div>
            )}
            <div>
              <p className="scoreboard text-2xl font-bold">
                {rec.goalsFor}:{rec.goalsAgainst}
              </p>
              <p className="text-[13px] text-muted">득실</p>
            </div>
            <div className="min-w-28">
              <Sparkline values={[...sessionMatches].reverse().map((m) => m.me.rating)} />
              <p className="text-[13px] text-muted">평점 추이</p>
            </div>
          </div>
        )}
      </section>

      {/* 직전 경기 */}
      {latest && (
        <section className="mt-4">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            가장 최근 경기
          </p>
          <div className="mt-2">
            <LiveMatchRow m={latest} ouid={ouid} highlight={false} />
          </div>
        </section>
      )}

      {/* 세션 경기 목록 */}
      {sessionMatches.length > 0 && (
        <section className="mt-5">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            세션 경기 {sessionMatches.length}
          </p>
          <ul className="mt-2 space-y-1.5">
            {sessionMatches.map((m) => (
              <li key={m.matchId} className={m.matchId === flashId ? "pop-in" : ""}>
                <LiveMatchRow m={m} ouid={ouid} highlight={m.matchId === flashId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-sm leading-relaxed text-muted">
        넥슨 API는 <b>끝난 경기</b>만 제공합니다. 경기 종료 후 반영까지 몇 분 걸릴 수
        있어요. 탭을 켜두면 60초마다 자동으로 확인합니다.
      </p>
    </div>
  );
}

function LiveMatchRow({
  m,
  ouid,
  highlight,
}: {
  m: MatchSummary;
  ouid: string;
  highlight: boolean;
}) {
  const badge =
    m.result === "승" ? "badge-win" : m.result === "패" ? "badge-lose" : "badge-draw";
  return (
    <Link
      href={`/match/${encodeURIComponent(m.matchId)}?me=${encodeURIComponent(ouid)}`}
      className={`panel flex items-center gap-3 px-3.5 py-3 transition-colors hover:border-accent/40 ${
        highlight ? "border-accent/50" : ""
      }`}
    >
      <span className={`badge-result ${badge}`}>{m.result}</span>
      <div className="scoreboard flex items-center gap-2 text-lg font-bold">
        <span>{m.me.goals}</span>
        <span className="text-xs text-muted">:</span>
        <span className="text-muted">{m.opponent?.goals ?? "-"}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {m.opponent ? `vs ${m.opponent.nickname}` : "상대 정보 없음"}
        </p>
        <p className="mt-0.5 text-sm text-muted">{formatMatchDate(m.matchDate)}</p>
      </div>
      <span className="scoreboard text-xs font-bold text-muted">리포트 →</span>
    </Link>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const pts = values.filter((v) => v > 0);
  if (pts.length < 2) return <p className="text-xs text-muted">—</p>;
  const w = 112;
  const h = 32;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const points = pts
    .map((v, i) => `${(i / (pts.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-28" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LiveError({ status, nickname }: { status: HardError; nickname: string }) {
  const msg =
    status === "not_found"
      ? `'${nickname}' 구단주를 찾을 수 없어요.`
      : "넥슨 API 연동 설정이 완료되지 않았습니다.";
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center">
      <h1 className="text-xl font-bold">라이브를 시작할 수 없어요</h1>
      <p className="mt-2 text-sm text-muted">{msg}</p>
      <Link
        href="/"
        className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink"
      >
        홈으로
      </Link>
    </div>
  );
}

function timeAgo(d: Date): string {
  const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (sec < 10) return "방금";
  if (sec < 60) return `${sec}초 전`;
  return `${Math.floor(sec / 60)}분 전`;
}

function dateVal(raw: string): number {
  const iso = raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

interface SessionRec {
  win: number;
  draw: number;
  lose: number;
  streak: number; // +연승 / -연패
  goalsFor: number;
  goalsAgainst: number;
}

function aggregate(matches: MatchSummary[]): SessionRec {
  let win = 0;
  let draw = 0;
  let lose = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const m of matches) {
    if (m.result === "승") win++;
    else if (m.result === "무") draw++;
    else if (m.result === "패") lose++;
    goalsFor += m.me.goals;
    goalsAgainst += m.opponent?.goals ?? 0;
  }
  // 연승/연패 — 최신(배열 앞)부터 같은 결과 연속 카운트
  let streak = 0;
  if (matches.length > 0) {
    const first = matches[0].result;
    if (first === "승" || first === "패") {
      for (const m of matches) {
        if (m.result !== first) break;
        streak++;
      }
      if (first === "패") streak = -streak;
    }
  }
  return { win, draw, lose, streak, goalsFor, goalsAgainst };
}
