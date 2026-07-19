import 'server-only';
import { getAdmin } from '@/lib/supabase/admin';
import { baseLabelOfCode, posLineOf } from '@/lib/squad/assign';
import type { RankerStat } from '@/lib/nexon/types';

export interface PickRow {
  spId: number;
  position: number;
  matchCount: number;
  rating: number;
  goalsPerMatch: number;
  /** 전일 대비 순위 변동 (+상승/−하락), null=NEW, undefined=비교 불가 */
  delta?: number | null;
}

/** 랭커 스냅샷이 워밍되는 매치 유형 (cron: ranker-snapshot). 그 외엔 데이터 없음. */
export const SNAPSHOT_MATCH_TYPES = [50, 52] as const;

/**
 * 채택일의 라인별 픽 랭킹을 스냅샷에서 로드.
 * @param matchType 기본 50 (공식경기) → /meta 기존 동작 보존
 * @param withDelta 기본 true. false면 전일 비교(추가 DB 호출) 생략
 */
export async function loadPicks(
  matchType: number = 50,
  withDelta: boolean = true
): Promise<{ date: string | null; byLine: Map<string, PickRow[]> }> {
  const empty = { date: null, byLine: new Map<string, PickRow[]>() };
  const db = getAdmin();
  if (!db) return empty;

  async function rowsForDate(cand: string): Promise<PickRow[]> {
    const db2 = getAdmin();
    if (!db2) return [];
    const { data } = await db2
      .from('ranker_stats_snapshot')
      .select('sp_id, sp_position, payload')
      .eq('match_type', matchType)
      .eq('snapshot_date', cand)
      .is('payload->empty', null) // tombstone({empty:true}) 제외
      .order('sp_id', { ascending: true }) // 결정적 순서 (임의 누락 방지)
      .limit(400);
    const rows: PickRow[] = [];
    for (const r of data ?? []) {
      const payload = r.payload as RankerStat | null;
      const st = payload?.status ?? {};
      const matchCount = st.matchCount ?? 0;
      if (matchCount <= 0) continue;
      rows.push({
        spId: r.sp_id as number,
        position: r.sp_position as number,
        matchCount,
        rating: st.spRating ?? 0,
        goalsPerMatch: Math.round(((st.goal ?? 0) / matchCount) * 100) / 100,
      });
    }
    return rows;
  }

  function groupByLine(rows: PickRow[]): Map<string, PickRow[]> {
    const byLine = new Map<string, PickRow[]>();
    for (const row of rows) {
      const line = posLineOf(baseLabelOfCode(row.position));
      const arr = byLine.get(line) ?? [];
      arr.push(row);
      byLine.set(line, arr);
    }
    for (const arr of byLine.values())
      arr.sort((a, b) => b.matchCount - a.matchCount);
    return byLine;
  }

  try {
    // 최근 날짜 후보를 뽑아, 유효 데이터가 충분한 날을 채택 (자정 직후 편향/빈 랭킹 방지)
    const { data: dateRows } = await db
      .from('ranker_stats_snapshot')
      .select('snapshot_date')
      .eq('match_type', matchType)
      .order('snapshot_date', { ascending: false })
      .limit(300);
    const candidates = [
      ...new Set((dateRows ?? []).map((r) => r.snapshot_date as string)),
    ].slice(0, 4);
    if (candidates.length === 0) return empty;

    const MIN_ROWS = 20;
    let date: string | null = null;
    let best: PickRow[] = [];
    let chosenIdx = -1;

    for (let i = 0; i < Math.min(candidates.length, 3); i++) {
      const rows = await rowsForDate(candidates[i]);
      if (rows.length >= MIN_ROWS) {
        date = candidates[i];
        best = rows;
        chosenIdx = i;
        break;
      }
      if (rows.length > best.length) {
        date = candidates[i];
        best = rows;
        chosenIdx = i;
      }
    }

    const byLine = groupByLine(best);

    // 순위 변동(▲▼/NEW): 채택일 다음 후보(=직전 스냅샷)와 라인 내 순위 비교
    if (withDelta) {
      const prevDate = chosenIdx >= 0 ? candidates[chosenIdx + 1] : undefined;
      if (prevDate) {
        const prevRows = await rowsForDate(prevDate);
        if (prevRows.length > 0) {
          const prevRank = new Map<string, number>();
          for (const [, arr] of groupByLine(prevRows)) {
            arr.forEach((r, idx) =>
              prevRank.set(`${r.spId}:${r.position}`, idx + 1)
            );
          }
          for (const [, arr] of byLine) {
            arr.forEach((r, idx) => {
              const prev = prevRank.get(`${r.spId}:${r.position}`);
              r.delta = prev === undefined ? null : prev - (idx + 1);
            });
          }
        }
      }
    }

    return { date, byLine };
  } catch {
    return empty;
  }
}

/**
 * 라인별 상위 topN 픽의 spId 집합(라인 → Set<spId>).
 * 대조는 정확 포지션 코드가 아니라 "같은 라인 안의 spId"로 한다 —
 * ST=24/25/26처럼 한 포지션이 여러 코드를 가져 정확 코드 매칭은 오탐(거짓 미포함)이 생기기 때문.
 */
export function topPickIdsByLine(
  byLine: Map<string, PickRow[]>,
  topN: number = 10
): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const [line, arr] of byLine) {
    out.set(line, new Set(arr.slice(0, topN).map((r) => r.spId)));
  }
  return out;
}

/** 카드(spId, 포지션 코드)가 자기 라인의 상위 topN 픽에 드는가. */
export function isTopPick(
  idsByLine: Map<string, Set<number>>,
  spId: number,
  positionCode: number
): boolean {
  const line = posLineOf(baseLabelOfCode(positionCode));
  return idsByLine.get(line)?.has(spId) ?? false;
}
