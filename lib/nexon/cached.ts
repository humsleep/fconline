import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import { guardDb } from '@/lib/supabase/circuit';
import { getMatchDetail } from './api';
import { slimMatchDetail } from './slim';
import { packMatchDetail, unpackMatchDetail } from './pack';
import type { MatchDetail } from './types';

function toIso(raw: string): string {
  return raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`;
}

/**
 * 매치 상세 — Supabase 영구 캐시 우선.
 * 경기 결과는 불변이므로 한 번 저장하면 넥슨 재호출이 필요 없다.
 * Supabase 미설정/장애 시 넥슨 직접 호출로 자연 강등(서킷 브레이커 fast-fail 포함).
 */
/**
 * `match_cache.ouids` 는 더 이상 쓰지 않는다.
 * 0017 에서 GIN 인덱스를 제거할 때 "어떤 쿼리도 ouids 로 조회하지 않음"이 코드 전수로 확인됐고,
 * 그 뒤로도 소비처가 없다. 읽지 않는 값을 매 저장마다 쓰는 것은 순수한 WAL·용량 낭비라
 * 컬럼째 제거한다(마이그레이션 0019).
 */
export async function getMatchDetailCached(
  matchid: string
): Promise<MatchDetail> {
  const db = getAdmin();

  if (db) {
    const res = await guardDb(() =>
      db.from('match_cache').select('payload').eq('match_id', matchid).maybeSingle()
    );
    const payload = (res?.data as { payload?: unknown } | null)?.payload;
    const cached = unpackMatchDetail(payload);
    if (cached) return cached;
  }

  const detail = await getMatchDetail(matchid);

  if (db) {
    await guardDb(() =>
      db.from('match_cache').upsert(
        {
          match_id: detail.matchId,
          match_type: detail.matchType,
          match_date: toIso(detail.matchDate),
          payload: packMatchDetail(slimMatchDetail(detail)),
        },
        { onConflict: 'match_id' }
      )
    );
  }

  return detail;
}

/**
 * 매치 상세 다건 조회 — 캐시를 한 번의 배치 쿼리로 읽어 왕복을 줄인다.
 * 캐시 히트는 1 쿼리로 끝나고, 미스만 넥슨(순차 큐)으로 채운 뒤 배치 upsert.
 * 반환은 입력 id 순서 유지(최신순), 조회 실패 건은 제외.
 */
/**
 * @param cacheOnly true 면 캐시 미스를 넥슨에서 가져오지 않는다(크롤러용).
 *                  넥슨 팬아웃과 match_cache 쓰기를 둘 다 0 으로 만든다.
 */
export async function getMatchDetailsBatch(
  ids: string[],
  cacheOnly = false
): Promise<MatchDetail[]> {
  if (ids.length === 0) return [];

  const db = getAdmin();
  const byId = new Map<string, MatchDetail>();

  if (db) {
    const res = await guardDb(() =>
      db.from('match_cache').select('match_id, payload').in('match_id', ids)
    );
    const rows = (res?.data as { match_id: string; payload: unknown }[] | null) ?? [];
    for (const row of rows) {
      const d = unpackMatchDetail(row.payload);
      if (d) byId.set(row.match_id, d);
    }
  }

  const misses = cacheOnly ? [] : ids.filter((id) => !byId.has(id));
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
    await guardDb(() =>
      db.from('match_cache').upsert(
        fetched.map((d) => ({
          match_id: d.matchId,
          match_type: d.matchType,
          match_date: toIso(d.matchDate),
          payload: packMatchDetail(slimMatchDetail(d)),
        })),
        { onConflict: 'match_id' }
      )
    );
  }

  return ids
    .map((id) => byId.get(id))
    .filter((d): d is MatchDetail => d !== undefined);
}
