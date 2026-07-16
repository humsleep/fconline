import type { MatchDetail, MatchInfoEntry } from './types';

export interface MatchSummary {
  matchId: string;
  matchDate: string;
  matchType: number;
  result: '승' | '무' | '패' | '?';
  forfeit: boolean; // 몰수 경기 여부
  me: { nickname: string; goals: number; possession: number; rating: number };
  opponent: { nickname: string; goals: number } | null;
}

/** match-detail에서 내 시점의 경기 요약 추출. 데이터 이상 시 null. */
export function summarizeMatch(
  detail: MatchDetail,
  ouid: string
): MatchSummary | null {
  const info = detail.matchInfo;
  if (!Array.isArray(info) || info.length === 0) return null;

  // 요청한 ouid가 이 경기 matchInfo에 없으면(닉네임 변경 지연 등) 상대를 '나'로 착각해
  // 승패·득점·평점이 조용히 반전된다 → 카드를 버려 오염 방지.
  const mine = info.find((e) => e.ouid === ouid);
  if (!mine) return null;
  const other = info.find((e) => e.ouid !== mine.ouid) ?? null;

  const result = mine.matchDetail?.matchResult;
  return {
    matchId: detail.matchId,
    matchDate: detail.matchDate,
    matchType: detail.matchType,
    result: result === '승' || result === '무' || result === '패' ? result : '?',
    forfeit: (mine.matchDetail?.matchEndType ?? 0) !== 0,
    me: {
      nickname: mine.nickname,
      goals: goalsOf(mine),
      possession: mine.matchDetail?.possession ?? 0,
      rating: mine.matchDetail?.averageRating ?? 0,
    },
    opponent: other ? { nickname: other.nickname, goals: goalsOf(other) } : null,
  };
}

function goalsOf(entry: MatchInfoEntry): number {
  // goalTotalDisplay가 실제 스코어보드 표기(자책골 반영)
  return entry.shoot?.goalTotalDisplay ?? entry.shoot?.goalTotal ?? 0;
}

export interface RecordSummary {
  played: number;
  win: number;
  draw: number;
  lose: number;
  winRate: number; // 0~100
  goalsFor: number;
  goalsAgainst: number;
  avgPossession: number;
}

export interface Rival {
  nickname: string;
  win: number;
  draw: number;
  lose: number;
  games: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** 자주 만난 상대(라이벌) H2H 집계 — 2회 이상 만난 상대를 횟수순으로 최대 limit명. */
export function topRivals(summaries: MatchSummary[], limit = 6): Rival[] {
  const map = new Map<string, Rival>();
  for (const m of summaries) {
    const nick = m.opponent?.nickname;
    if (!nick) continue;
    const r =
      map.get(nick) ??
      { nickname: nick, win: 0, draw: 0, lose: 0, games: 0, goalsFor: 0, goalsAgainst: 0 };
    if (m.result === '승') r.win++;
    else if (m.result === '패') r.lose++;
    else if (m.result === '무') r.draw++;
    r.games++;
    r.goalsFor += m.me.goals;
    r.goalsAgainst += m.opponent?.goals ?? 0;
    map.set(nick, r);
  }
  return [...map.values()]
    .filter((r) => r.games >= 2)
    .sort((a, b) => b.games - a.games || b.win - a.win)
    .slice(0, limit);
}

export function aggregate(matches: MatchSummary[]): RecordSummary {
  const played = matches.length;
  let win = 0;
  let draw = 0;
  let lose = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let possession = 0;

  for (const m of matches) {
    if (m.result === '승') win++;
    else if (m.result === '무') draw++;
    else if (m.result === '패') lose++;
    goalsFor += m.me.goals;
    goalsAgainst += m.opponent?.goals ?? 0;
    possession += m.me.possession;
  }

  return {
    played,
    win,
    draw,
    lose,
    winRate: played ? Math.round((win / played) * 100) : 0,
    goalsFor,
    goalsAgainst,
    avgPossession: played ? Math.round(possession / played) : 0,
  };
}
