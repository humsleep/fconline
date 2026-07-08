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

  const mine = info.find((e) => e.ouid === ouid) ?? info[0];
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
