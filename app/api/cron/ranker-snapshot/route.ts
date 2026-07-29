import { getAdmin } from '@/lib/supabase/admin';
import { getRankerStatsCached, rankerKey } from '@/lib/nexon/ranker';
import type { MatchDetail } from '@/lib/nexon/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 스냅샷 대상 매치 종류 (공식경기 / 감독모드)
const MATCH_TYPES = [50, 52];
const RECENT_MATCHES = 400; // 인기 집계에 쓸 최근 캐시 매치 수
const TOP_PLAYERS = 60; // 매치 종류별 예열할 선수×포지션 조합 수

/**
 * 랭커 스냅샷 워밍 크론 (Vercel Cron, 일 1회).
 * match_cache에서 최근 자주 쓰인 선수×포지션을 뽑아 랭커 스탯을 미리 채워둔다.
 * 부산물: 스냅샷이 쌓이면 "이번 주 뜨는 카드" 시계열 자산이 된다.
 */
export async function GET(req: Request) {
  // fail-closed: CRON_SECRET 미설정이면 크론 자체가 동작하지 않음(개방 금지).
  // Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer 헤더를 자동 전송.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const db = getAdmin();
  if (!db) {
    return Response.json({ ok: false, reason: 'supabase not configured' });
  }

  const summary: Record<string, number> = {};

  for (const matchtype of MATCH_TYPES) {
    let rows: { payload: MatchDetail }[] = [];
    try {
      const { data } = await db
        .from('match_cache')
        .select('payload')
        .eq('match_type', matchtype)
        .order('match_date', { ascending: false })
        .limit(RECENT_MATCHES);
      rows = (data as { payload: MatchDetail }[]) ?? [];
    } catch {
      summary[`type_${matchtype}`] = -1;
      continue;
    }

    // 선수×포지션 사용 빈도 집계
    const freq = new Map<string, { id: number; po: number; n: number }>();
    for (const row of rows) {
      for (const e of row.payload?.matchInfo ?? []) {
        for (const p of e.player ?? []) {
          if ((p.status?.spRating ?? 0) <= 0 || p.spPosition === 28) continue;
          const key = rankerKey(p.spId, p.spPosition);
          const cur = freq.get(key);
          if (cur) cur.n += 1;
          else freq.set(key, { id: p.spId, po: p.spPosition, n: 1 });
        }
      }
    }

    let top = [...freq.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, TOP_PLAYERS)
      .map((p) => ({ id: p.id, po: p.po }));

    // 폴백: match_cache가 비면(콜드스타트) 직전 스냅샷의 조합을 재예열
    // → 한 번 시딩되면 검색이 없어도 랭킹이 매일 갱신·유지된다.
    if (top.length === 0) {
      try {
        const { data: prev } = await db
          .from('ranker_stats_snapshot')
          .select('sp_id, sp_position, snapshot_date')
          .eq('match_type', matchtype)
          .is('payload->empty', null)
          .order('snapshot_date', { ascending: false })
          .limit(TOP_PLAYERS * 3);
        const seen = new Set<string>();
        const combos: { id: number; po: number }[] = [];
        for (const r of prev ?? []) {
          const key = rankerKey(r.sp_id as number, r.sp_position as number);
          if (seen.has(key)) continue;
          seen.add(key);
          combos.push({ id: r.sp_id as number, po: r.sp_position as number });
          if (combos.length >= TOP_PLAYERS) break;
        }
        top = combos;
      } catch {
        // 폴백 실패 시 이번 타입은 건너뜀
      }
    }

    const warmed = await getRankerStatsCached(matchtype, top);
    summary[`type_${matchtype}`] = warmed.size;
  }

  // 보관기간 정리 — 캐시 테이블 무한 증가 방지(Disk + 무료 500MB 한도 + IO).
  // 핫패스는 최근 매치/스냅샷만 읽으므로 오래된 행은 삭제해도 안전
  // (오래된 매치는 조회 시 넥슨에서 재캐시됨). best-effort, 실패해도 크론 성공.
  const retention: Record<string, number> = {};
  const day = 24 * 60 * 60 * 1000;
  try {
    const cutoff = new Date(Date.now() - 90 * day).toISOString();
    const { count } = await db
      .from('match_cache')
      .delete({ count: 'estimated' })
      .lt('match_date', cutoff);
    retention.match_cache_deleted = count ?? 0;
  } catch {
    retention.match_cache_deleted = -1;
  }
  try {
    const snapCutoff = new Date(Date.now() - 60 * day)
      .toISOString()
      .slice(0, 10); // snapshot_date는 date 타입
    const { count } = await db
      .from('ranker_stats_snapshot')
      .delete({ count: 'estimated' })
      .lt('snapshot_date', snapCutoff);
    retention.ranker_snapshot_deleted = count ?? 0;
  } catch {
    retention.ranker_snapshot_deleted = -1;
  }

  return Response.json({ ok: true, warmed: summary, retention });
}
