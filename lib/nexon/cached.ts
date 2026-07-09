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
