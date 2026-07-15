import { cache } from 'react';
import { getUserMatches } from './api';
import { getMatchDetailsBatch } from './cached';
import { NexonApiError } from './client';
import type { MatchDetail } from './types';

/**
 * 최근 매치 상세 일괄 조회 — React cache()로 같은 요청 렌더 안에서
 * (히어로 배지 + 경기 기록 섹션 등) 중복 넥슨 호출을 1회로 합친다.
 */
export const getRecentMatchDetails = cache(
  async (
    ouid: string,
    matchType: number,
    count: number
  ): Promise<{ listOk: boolean; matchIds: string[]; details: MatchDetail[] }> => {
    let matchIds: string[] = [];
    let listOk = true; // 목록 조회 실패를 '경기 없음'으로 위장하지 않기 위함
    try {
      matchIds = await getUserMatches(ouid, matchType, count);
    } catch (err) {
      if (!(err instanceof NexonApiError)) throw err;
      listOk = false;
    }
    const details = await getMatchDetailsBatch(matchIds);
    return { listOk, matchIds, details };
  }
);
