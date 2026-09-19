import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import type { RankerStat } from './types';

export interface PlayerPositionStat {
  position: number;
  matchCount: number;
  goal: number;
  assist: number;
  shoot: number;
  effectiveShoot: number;
  passSuccess: number;
  passTry: number;
  dribbleSuccess: number;
  dribbleTry: number;
  tackle: number;
  block: number;
  /** 최근 공식경기에서 이 포지션으로 선발 출전한 횟수(크론 행에만). 정렬 기준 */
  usage?: number;
}

export interface PlayerRankerMeta {
  date: string | null;
  totalMatches: number; // 랭커 표본 경기 수(넥슨은 조합당 최근 20경기 평균을 준다 — 포지션 합이 아니다)
  positions: PlayerPositionStat[]; // matchCount 내림차순
}

/**
 * 선수 도감용 — 특정 spid의 랭커 실사용 스탯을 최신 스냅샷에서 포지션별로 조회.
 * 매일 수집하는 ranker_stats_snapshot 재활용(넥슨 추가 호출 없음). 데이터 없으면 빈 결과.
 */
export async function getPlayerRankerMeta(spid: number, matchType: number = 50): Promise<PlayerRankerMeta> {
  const empty: PlayerRankerMeta = { date: null, totalMatches: 0, positions: [] };
  const db = getAdmin();
  if (!db) return empty;

  try {
    const { data } = await db
      .from('ranker_stats_snapshot')
      .select('sp_position, payload, snapshot_date')
      .eq('match_type', matchType)
      .eq('sp_id', spid)
      .is('payload->empty', null) // tombstone 제외
      .order('snapshot_date', { ascending: false })
      .limit(60);
    if (!data || data.length === 0) return empty;

    // 최근 7일 안에서 포지션별 가장 최신 행을 합친다. 최신 날짜 하나만 쓰면, 오늘 누가 한 포지션만 조회했을 때
    // 어제까지 있던 다른 포지션이 사라졌다.
    const latest = data[0].snapshot_date as string;
    const cutoff = new Date(Date.parse(`${latest}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
    const seen = new Set<number>();
    const positions: PlayerPositionStat[] = [];
    for (const r of data) {
      if ((r.snapshot_date as string) < cutoff) continue;
      const pos = r.sp_position as number;
      if (seen.has(pos)) continue;
      seen.add(pos);
      const payload = r.payload as (RankerStat & { usage?: number }) | null;
      const st = payload?.status ?? {};
      const matchCount = st.matchCount ?? 0;
      if (matchCount <= 0) continue;
      positions.push({
        position: r.sp_position as number,
        matchCount,
        goal: st.goal ?? 0,
        assist: st.assist ?? 0,
        shoot: st.shoot ?? 0,
        effectiveShoot: st.effectiveShoot ?? 0,
        passSuccess: st.passSuccess ?? 0,
        passTry: st.passTry ?? 0,
        dribbleSuccess: st.dribbleSuccess ?? 0,
        dribbleTry: st.dribbleTry ?? 0,
        tackle: st.tackle ?? 0,
        block: st.block ?? 0,
        ...(typeof payload?.usage === 'number' ? { usage: payload.usage } : {}),
      });
    }
    // matchCount 는 조합마다 20 으로 같다 — 실제 선발 횟수(usage)로 주 포지션을 정한다.
    positions.sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0) || b.matchCount - a.matchCount || a.position - b.position);
    const totalMatches = positions.reduce((a, p) => Math.max(a, p.matchCount), 0);
    return { date: latest, totalMatches, positions };
  } catch {
    return empty;
  }
}
