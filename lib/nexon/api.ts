import { nexonFetch } from './client';
import type { MatchDetail, MaxDivision, UserBasic } from './types';

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
