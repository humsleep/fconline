import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import type { RankerStat } from './types';

export interface PlayerPositionStat {
  position: number;
  matchCount: number;
  rating: number;
  goal: number;
  assist: number;
  shoot: number;
  effectiveShoot: number;
  passSuccess: number;
  passTry: number;
  dribbleSuccess: number;
  dribbleTry: number;
  tackle: number;
  intercept: number;
}

export interface PlayerRankerMeta {
  date: string | null;
  totalMatches: number; // 전 포지션 랭커 경기 합
  positions: PlayerPositionStat[]; // matchCount 내림차순
}

/**
 * 선수 도감용 — 특정 spid의 랭커 실사용 스탯을 최신 스냅샷에서 포지션별로 조회.
 * 매일 수집하는 ranker_stats_snapshot 재활용(넥슨 추가 호출 없음). 데이터 없으면 빈 결과.
 */
export async function getPlayerRankerMeta(spid: number): Promise<PlayerRankerMeta> {
  const empty: PlayerRankerMeta = { date: null, totalMatches: 0, positions: [] };
  const db = getAdmin();
  if (!db) return empty;

  try {
    const { data } = await db
      .from('ranker_stats_snapshot')
      .select('sp_position, payload, snapshot_date')
      .eq('match_type', 50)
      .eq('sp_id', spid)
      .is('payload->empty', null) // tombstone 제외
      .order('snapshot_date', { ascending: false })
      .limit(60);
    if (!data || data.length === 0) return empty;

    // 가장 최근 스냅샷 날짜의 행만 사용
    const latest = data[0].snapshot_date as string;
    const positions: PlayerPositionStat[] = [];
    for (const r of data) {
      if ((r.snapshot_date as string) !== latest) continue;
      const st = (r.payload as RankerStat | null)?.status ?? {};
      const matchCount = st.matchCount ?? 0;
      if (matchCount <= 0) continue;
      positions.push({
        position: r.sp_position as number,
        matchCount,
        rating: st.spRating ?? 0,
        goal: st.goal ?? 0,
        assist: st.assist ?? 0,
        shoot: st.shoot ?? 0,
        effectiveShoot: st.effectiveShoot ?? 0,
        passSuccess: st.passSuccess ?? 0,
        passTry: st.passTry ?? 0,
        dribbleSuccess: st.dribbleSuccess ?? 0,
        dribbleTry: st.dribbleTry ?? 0,
        tackle: st.tackle ?? 0,
        intercept: st.intercept ?? 0,
      });
    }
    positions.sort((a, b) => b.matchCount - a.matchCount);
    const totalMatches = positions.reduce((a, p) => a + p.matchCount, 0);
    return { date: latest, totalMatches, positions };
  } catch {
    return empty;
  }
}
