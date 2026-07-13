import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import { getRankerStats } from './api';
import type { RankerStat } from './types';

export type RankerMap = Map<string, RankerStat>;

export function rankerKey(spId: number, spPosition: number): string {
  return `${spId}:${spPosition}`;
}

/** 스냅샷 날짜 키 (KST 기준 — UTC 자정~9시 경계에서 캐시 히트율 유지) */
function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 랭커 데이터가 없는 조합의 tombstone 마커 (재조회 방지용)
const EMPTY_MARKER = { empty: true } as const;

/**
 * 랭커 스탯 조회 — ranker_stats_snapshot(당일) 우선, 미스만 라이브 배치 호출 후 저장.
 * ranker-stats는 변동 데이터라 하루 1스냅샷으로 레이트리밋을 흡수한다.
 * players는 최대 조회 수 제한이 있을 수 있어 청크(20)로 분할 호출.
 */
export async function getRankerStatsCached(
  matchtype: number,
  players: { id: number; po: number }[]
): Promise<RankerMap> {
  const out: RankerMap = new Map();
  if (players.length === 0) return out;

  // 중복 제거
  const uniq = new Map<string, { id: number; po: number }>();
  for (const p of players) uniq.set(rankerKey(p.id, p.po), p);
  const wanted = [...uniq.values()];

  const db = getAdmin();
  const today = kstToday();
  const misses: { id: number; po: number }[] = [];

  if (db) {
    try {
      const { data } = await db
        .from('ranker_stats_snapshot')
        .select('sp_id, sp_position, payload')
        .eq('match_type', matchtype)
        .eq('snapshot_date', today)
        .in(
          'sp_id',
          wanted.map((p) => p.id)
        );
      const hit = new Set<string>();
      for (const row of data ?? []) {
        const key = rankerKey(row.sp_id, row.sp_position);
        if (!uniq.has(key)) continue;
        hit.add(key); // 당일 조회됨 — tombstone이어도 재요청 안 함
        const payload = row.payload as RankerStat | { empty: true } | null;
        if (payload && !('empty' in payload)) out.set(key, payload);
      }
      for (const p of wanted) {
        if (!hit.has(rankerKey(p.id, p.po))) misses.push(p);
      }
    } catch {
      misses.push(...wanted); // 캐시 조회 실패 → 전부 라이브 시도
    }
  } else {
    misses.push(...wanted);
  }

  if (misses.length === 0) return out;

  const fresh: RankerStat[] = [];
  // 성공적으로 응답받은 청크의 조합만 모음 — 이 안에서 응답에 없는 조합만 "진짜 데이터 없음"이다.
  // 넥슨 장애/429로 throw한 청크는 여기 안 들어가므로 tombstone으로 오염되지 않는다.
  const succeeded: { id: number; po: number }[] = [];
  for (let i = 0; i < misses.length; i += 20) {
    const chunk = misses.slice(i, i + 20);
    try {
      const stats = await getRankerStats(matchtype, chunk);
      fresh.push(...stats);
      succeeded.push(...chunk);
    } catch {
      // 청크 실패(신규 카드로 데이터 없음일 수도, 넥슨 장애일 수도) → tombstone 없이 건너뜀.
      // 다음 요청/크론이 재시도한다.
    }
  }

  const foundKeys = new Set<string>();
  for (const stat of fresh) {
    const key = rankerKey(stat.spId, stat.spPosition);
    out.set(key, stat);
    foundKeys.add(key);
  }

  if (db) {
    // 응답에 있는 조합은 실데이터로, 성공한 청크에서 응답에 없던 조합만 tombstone으로 저장
    // → 랭커 데이터 없는 선수가 매 요청마다 라이브 호출되는 것을 차단.
    // (실패한 청크는 제외 — 넥슨 순단 1회가 하루 종일 "데이터 없음"으로 굳는 것을 방지)
    const rows = [
      ...fresh.map((stat) => ({
        match_type: matchtype,
        sp_id: stat.spId,
        sp_position: stat.spPosition,
        snapshot_date: today,
        payload: stat,
      })),
      ...succeeded
        .filter((m) => !foundKeys.has(rankerKey(m.id, m.po)))
        .map((m) => ({
          match_type: matchtype,
          sp_id: m.id,
          sp_position: m.po,
          snapshot_date: today,
          payload: EMPTY_MARKER,
        })),
    ];
    if (rows.length > 0) {
      try {
        await db
          .from('ranker_stats_snapshot')
          .upsert(rows, {
            onConflict: 'match_type,sp_id,sp_position,snapshot_date',
          });
      } catch {
        // 저장 실패해도 응답에는 영향 없음
      }
    }
  }

  return out;
}
