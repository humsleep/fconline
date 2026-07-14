import { nexonFetch } from './client';
import type { MatchDetail, MaxDivision, RankerStat, TradeRecord, UserBasic } from './types';

/** 닉네임 → 계정 식별자. 닉네임 변경 직후에는 조회 실패 가능. */
export async function getOuid(nickname: string): Promise<string> {
  const res = await nexonFetch<{ ouid: string }>('id', { nickname }, 3600);
  return res.ouid;
}

export function getUserBasic(ouid: string): Promise<UserBasic> {
  return nexonFetch<UserBasic>('user/basic', { ouid }, 300);
}

export function getMaxDivisions(ouid: string): Promise<MaxDivision[]> {
  return nexonFetch<MaxDivision[]>('user/maxdivision', { ouid }, 3600);
}

/** 매치 ID 목록 (최신순). limit 최대 100. */
export function getUserMatches(
  ouid: string,
  matchtype: number,
  limit = 10,
  offset = 0
): Promise<string[]> {
  return nexonFetch<string[]>(
    'user/match',
    { ouid, matchtype, offset, limit },
    60
  );
}

/** 매치 상세 — 경기 결과는 불변이므로 영구 캐시 */
export function getMatchDetail(matchid: string): Promise<MatchDetail> {
  return nexonFetch<MatchDetail>('match-detail', { matchid }, 'immutable');
}

/**
 * 이적시장 거래 기록 — tradetype 'buy'(영입) 또는 'sell'(방출). 최신순, limit 최대 100.
 * 신버전 경로 관례(user/basic 등)에 맞춰 user/trade 사용.
 */
export function getUserTrades(
  ouid: string,
  tradetype: 'buy' | 'sell',
  limit = 50,
  offset = 0
): Promise<TradeRecord[]> {
  return nexonFetch<TradeRecord[]>(
    'user/trade',
    { ouid, tradetype, offset, limit },
    300
  );
}

/**
 * 랭커 선수 스탯 — 선수×포지션 조합 배열을 한 번에 조회.
 * players = [{ id: spId, po: spPosition }, ...] (URL 인코딩 JSON)
 * 변동 데이터라 짧은 revalidate만; 장기 보관은 ranker_stats_snapshot 사용.
 */
export function getRankerStats(
  matchtype: number,
  players: { id: number; po: number }[]
): Promise<RankerStat[]> {
  return nexonFetch<RankerStat[]>(
    'ranker-stats',
    { matchtype, players: JSON.stringify(players) },
    3600
  );
}
