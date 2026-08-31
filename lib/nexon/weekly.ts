import type { MatchSummary } from './summary';
import { matchScore } from './score';

/**
 * 주간 결산(최근 7일) — Spotify Wrapped / Strava 주간 요약형 정기 재방문 훅.
 * 이미 로드된 summaries만 사용(추가 넥슨 호출·마이그레이션 없음). 순수 함수.
 */
export interface WeeklyRecap {
  games: number;
  win: number;
  draw: number;
  lose: number;
  winRate: number; // 0~100 정수
  bestStreak: number; // 주간 최다 연승
  goalsFor: number;
  goalsAgainst: number;
  avgScore: number; // 주간 FC 스코어 평균 (0~10, 소수1)
  best: { matchId: string; score: number } | null; // 이번 주 최고 경기(몰수 제외)
}

const WEEK_MS = 7 * 86_400_000;

function toTime(raw: string): number {
  const iso = raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`;
  return new Date(iso).getTime();
}

/** 최근 7일 경기로 주간 결산. 몰수는 승패·득실엔 포함하되 '최고 경기' 후보에선 제외. */
export function weeklyRecap(
  summaries: MatchSummary[],
  now: number = Date.now()
): WeeklyRecap {
  const since = now - WEEK_MS;
  // 시간순(오래된→최신)으로 정렬해 연승을 정확히 계산
  const week = summaries
    .filter((m) => {
      const t = toTime(m.matchDate);
      return !Number.isNaN(t) && t >= since && t <= now;
    })
    .sort((a, b) => toTime(a.matchDate) - toTime(b.matchDate));

  let win = 0,
    draw = 0,
    lose = 0,
    gf = 0,
    ga = 0,
    scoreSum = 0,
    cur = 0,
    bestStreak = 0;
  let best: { matchId: string; score: number } | null = null;

  for (const m of week) {
    if (m.result === '승') {
      win++;
      cur++;
      if (cur > bestStreak) bestStreak = cur;
    } else if (m.result === '패') {
      lose++;
      cur = 0;
    } else if (m.result === '무') {
      draw++;
      cur = 0;
    }
    gf += m.me.goals;
    ga += m.opponent?.goals ?? 0;
    const sc = matchScore(m);
    scoreSum += sc;
    if (!m.forfeit && (!best || sc > best.score)) best = { matchId: m.matchId, score: sc };
  }

  const games = week.length;
  return {
    games,
    win,
    draw,
    lose,
    winRate: games ? Math.round((win / games) * 100) : 0,
    bestStreak,
    goalsFor: gf,
    goalsAgainst: ga,
    avgScore: games ? Math.round((scoreSum / games) * 10) / 10 : 0,
    best,
  };
}
