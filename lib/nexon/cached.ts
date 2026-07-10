import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import { getMatchDetail } from './api';
import type { MatchDetail } from './types';

function toIso(raw: string): string {
  return raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`;
}

/**
 * 매치 상세 — Supabase 영구 캐시 우선.
 * 경기 결과는 불변이므로 한 번 저장하면 넥슨 재호출이 필요 없다.
 * Supabase 미설정/장애 시 넥슨 직접 호출로 자연 강등.
 */
export async function getMatchDetailCached(
  matchid: string
): Promise<MatchDetail> {
  const db = getAdmin();

  if (db) {
    try {
      const { data } = await db
        .from('match_cache')
        .select('payload')
        .eq('match_id', matchid)
        .maybeSingle();
      if (data?.payload) return data.payload as MatchDetail;
    } catch {
      // 캐시 조회 실패는 무시하고 원본 호출
    }
  }

  const detail = await getMatchDetail(matchid);

  if (db) {
    try {
      await db.from('match_cache').upsert(
        {
          match_id: detail.matchId,
          match_type: detail.matchType,
          match_date: toIso(detail.matchDate),
          ouids: detail.matchInfo?.map((e) => e.ouid) ?? [],
          payload: detail,
        },
        { onConflict: 'match_id' }
      );
    } catch {
      // 저장 실패해도 응답에는 영향 없음
    }
  }

  return detail;
}

/**
 * 매치 상세 다건 조회 — 캐시를 한 번의 배치 쿼리로 읽어 왕복을 줄인다.
 * 캐시 히트는 1 쿼리로 끝나고, 미스만 넥슨(순차 큐)으로 채운 뒤 배치 upsert.
 * 반환은 입력 id 순서 유지(최신순), 조회 실패 건은 제외.
 */
export async function getMatchDetailsBatch(
  ids: string[]
): Promise<MatchDetail[]> {
  if (ids.length === 0) return [];

  const db = getAdmin();
  const byId = new Map<string, MatchDetail>();

  if (db) {
    try {
      const { data } = await db
        .from('match_cache')
        .select('match_id, payload')
        .in('match_id', ids);
      for (const row of data ?? []) {
        byId.set(row.match_id as string, row.payload as MatchDetail);
      }
    } catch {
      // 캐시 조회 실패 → 전부 미스로 처리
    }
  }

  const misses = ids.filter((id) => !byId.has(id));
  const fetched: MatchDetail[] = [];

  // 넥슨 호출은 nexonFetch 순차 큐가 직렬화하므로 allSettled로 한 번에 예약해도 안전
  const results = await Promise.allSettled(misses.map((id) => getMatchDetail(id)));
  for (const r of results) {
    if (r.status === 'fulfilled') {
      byId.set(r.value.matchId, r.value);
      fetched.push(r.value);
    }
    // 개별 실패(닉네임 변경 반영 대기 등)는 조용히 제외
  }

  if (db && fetched.length > 0) {
    try {
      await db.from('match_cache').upsert(
        fetched.map((d) => ({
          match_id: d.matchId,
          match_type: d.matchType,
          match_date: toIso(d.matchDate),
          ouids: d.matchInfo?.map((e) => e.ouid) ?? [],
          payload: d,
        })),
        { onConflict: 'match_id' }
      );
    } catch {
      // 저장 실패해도 응답에는 영향 없음
    }
  }

  return ids
    .map((id) => byId.get(id))
    .filter((d): d is MatchDetail => d !== undefined);
}
