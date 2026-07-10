import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import { getPlayerNames } from './nexon/players';
import { getRankerStatsCached, rankerKey } from './nexon/ranker';
import type { RankerStat } from './nexon/types';
import { verdictFromRating, type Verdict } from './verdict';

export const VS_MATCH_TYPE = 50; // 공식경기 기준

/** 대결 키 — spId 오름차순 정규화. A=작은 spId, B=큰 spId로 고정(투표 일관성). */
export function vsKey(spIdX: number, spIdY: number, pos: number): string {
  const [a, b] = spIdX <= spIdY ? [spIdX, spIdY] : [spIdY, spIdX];
  return `${a}:${b}:${pos}`;
}

export function canonicalPair(
  spIdX: number,
  spIdY: number
): [number, number] {
  return spIdX <= spIdY ? [spIdX, spIdY] : [spIdY, spIdX];
}

export interface VsSide {
  spId: number;
  name: string;
  rating: number;
  attackP: number; // 경기당 공격포인트(골+어시)
  passRate: number | null;
  matchCount: number | null;
  verdict: Verdict;
}

export interface VsMetric {
  label: string;
  a: number;
  b: number;
  max: number;
  unit: string;
}

export interface VsComparison {
  available: boolean;
  pos: number;
  vsKey: string;
  matchType: number;
  a: VsSide | null;
  b: VsSide | null;
  metrics: VsMetric[];
  winner: 'A' | 'B' | null;
}

function toSide(stat: RankerStat, name: string): Omit<VsSide, 'verdict'> {
  const s = stat.status ?? {};
  const rating = s.spRating ?? 0;
  const attackP = (s.goal ?? 0) + (s.assist ?? 0);
  const passRate =
    s.passTry && s.passTry > 0
      ? Math.round(((s.passSuccess ?? 0) / s.passTry) * 100)
      : null;
  return {
    spId: stat.spId,
    name,
    rating,
    attackP: Math.round(attackP * 100) / 100,
    passRate,
    matchCount: s.matchCount ?? null,
  };
}

/**
 * 두 선수(카드) 비교 모델. A=작은 spId로 정규화.
 * 랭커 데이터가 한쪽이라도 없으면 available:false.
 */
export async function buildComparison(
  spIdX: number,
  spIdY: number,
  pos: number,
  matchType: number = VS_MATCH_TYPE
): Promise<VsComparison> {
  const [aId, bId] = canonicalPair(spIdX, spIdY);
  const key = vsKey(aId, bId, pos);

  const ranker = await getRankerStatsCached(matchType, [
    { id: aId, po: pos },
    { id: bId, po: pos },
  ]);
  const aStat = ranker.get(rankerKey(aId, pos));
  const bStat = ranker.get(rankerKey(bId, pos));

  if (!aStat || !bStat) {
    return {
      available: false,
      pos,
      vsKey: key,
      matchType,
      a: null,
      b: null,
      metrics: [],
      winner: null,
    };
  }

  const names = await getPlayerNames([aId, bId]);
  const aBase = toSide(aStat, names.get(aId) ?? `선수 ${aId}`);
  const bBase = toSide(bStat, names.get(bId) ?? `선수 ${bId}`);

  const a: VsSide = {
    ...aBase,
    verdict: verdictFromRating({ rating: aBase.rating, subjectType: 'player', seed: aId }),
  };
  const b: VsSide = {
    ...bBase,
    verdict: verdictFromRating({ rating: bBase.rating, subjectType: 'player', seed: bId }),
  };

  const metrics: VsMetric[] = [
    { label: '평점', a: a.rating, b: b.rating, max: 10, unit: '' },
    { label: '경기당 공격P', a: a.attackP, b: b.attackP, max: 3, unit: '' },
  ];
  if (a.passRate !== null && b.passRate !== null) {
    metrics.push({ label: '패스 성공률', a: a.passRate, b: b.passRate, max: 100, unit: '%' });
  }

  // 승자: 평점 우선, 동률이면 공격P
  let winner: 'A' | 'B' | null = null;
  if (a.rating !== b.rating) winner = a.rating > b.rating ? 'A' : 'B';
  else if (a.attackP !== b.attackP) winner = a.attackP > b.attackP ? 'A' : 'B';

  return { available: true, pos, vsKey: key, matchType, a, b, metrics, winner };
}

/** KST 오늘 날짜 (YYYY-MM-DD) */
function kstDate(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * "오늘의 VS" — 랭커 스냅샷에서 같은 포지션·평점 근접 쌍을 날짜 시드로 선정.
 * 운영자 개입 0. 데이터 부족 시 null (홈은 '곧 공개' 표시).
 */
export async function getTodaysVs(
  matchType: number = VS_MATCH_TYPE
): Promise<{ aSpId: number; bSpId: number; pos: number } | null> {
  const db = getAdmin();
  if (!db) return null;

  type Row = {
    sp_id: number;
    sp_position: number;
    snapshot_date: string;
    payload: RankerStat | { empty: true };
  };
  let rows: Row[] = [];
  try {
    const { data } = await db
      .from('ranker_stats_snapshot')
      .select('sp_id, sp_position, snapshot_date, payload')
      .eq('match_type', matchType)
      // 2차·3차 정렬로 절단·순서를 결정화 (같은 날 같은 결과 보장)
      .order('snapshot_date', { ascending: false })
      .order('sp_position', { ascending: true })
      .order('sp_id', { ascending: true })
      .limit(300);
    rows = (data as Row[]) ?? [];
  } catch {
    return null;
  }
  if (rows.length === 0) return null;

  // 크론이 오늘 예열한 데이터와 정렬되도록 최신 스냅샷 날짜만 사용
  const latestDate = rows[0].snapshot_date;

  // 포지션별로 평점 있는 선수 모으기 (tombstone 제외)
  const byPos = new Map<number, { spId: number; rating: number }[]>();
  for (const r of rows) {
    if (r.snapshot_date !== latestDate) continue;
    const payload = r.payload;
    if (!payload || 'empty' in payload) continue;
    const rating = payload.status?.spRating ?? 0;
    if (rating <= 0) continue;
    const arr = byPos.get(r.sp_position) ?? [];
    arr.push({ spId: r.sp_id, rating });
    byPos.set(r.sp_position, arr);
  }

  // 평점 근접(≤0.3 차) 쌍 후보 수집
  const pairs: { aSpId: number; bSpId: number; pos: number }[] = [];
  for (const [pos, arr] of byPos) {
    if (arr.length < 2) continue;
    arr.sort((x, y) => y.rating - x.rating || x.spId - y.spId);
    for (let i = 0; i < arr.length - 1; i++) {
      if (Math.abs(arr[i].rating - arr[i + 1].rating) <= 0.3) {
        const [a, b] = canonicalPair(arr[i].spId, arr[i + 1].spId);
        pairs.push({ aSpId: a, bSpId: b, pos });
      }
    }
  }
  if (pairs.length === 0) return null;

  // 안정 정렬 후 날짜 시드로 선택 → 같은 날·같은 데이터면 항상 같은 VS
  pairs.sort(
    (x, y) => x.pos - y.pos || x.aSpId - y.aSpId || x.bSpId - y.bSpId
  );
  const p = pairs[hashStr(kstDate()) % pairs.length];
  return { aSpId: p.aSpId, bSpId: p.bSpId, pos: p.pos };
}

export interface VoteCounts {
  a: number;
  b: number;
  total: number;
}

export async function getVoteCounts(key: string): Promise<VoteCounts> {
  const db = getAdmin();
  if (!db) return { a: 0, b: 0, total: 0 };
  try {
    const { data } = await db.from('vs_votes').select('pick').eq('vs_key', key);
    let a = 0;
    let b = 0;
    for (const row of data ?? []) {
      if (row.pick === 'A') a++;
      else if (row.pick === 'B') b++;
    }
    return { a, b, total: a + b };
  } catch {
    return { a: 0, b: 0, total: 0 };
  }
}

export async function castVote(
  key: string,
  voter: string,
  pick: 'A' | 'B'
): Promise<VoteCounts> {
  const db = getAdmin();
  if (db) {
    try {
      await db
        .from('vs_votes')
        .upsert({ vs_key: key, voter, pick }, { onConflict: 'vs_key,voter' });
    } catch {
      // 저장 실패해도 카운트는 반환
    }
  }
  return getVoteCounts(key);
}
