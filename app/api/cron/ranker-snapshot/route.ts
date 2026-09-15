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
  // match_cache 보관기간 90일 → 30일.
  // 실측(2026-09-04) 1,663MB / 31만 행까지 자라 디스크 IO 장애를 두 차례 유발했다.
  // 오래된 매치는 조회 시 넥슨에서 재캐시되므로 삭제해도 기능 손실이 없다.
  //
  // ⚠️ 한 번에 지우면 WAL 이 폭증한다(과거 WAL 디스크 천장 크래시 이력).
  //    5,000행씩 나눠 지우고, 한 실행당 상한을 둬 며칠에 걸쳐 수렴시킨다.
  try {
    const cutoff = new Date(Date.now() - 30 * day).toISOString();
    const BATCH = 5_000;
    const MAX_PER_RUN = 50_000;
    let deleted = 0;
    while (deleted < MAX_PER_RUN) {
      const { data: doomed } = await db
        .from('match_cache')
        .select('match_id')
        .lt('match_date', cutoff)
        .limit(BATCH);
      const ids = (doomed ?? []).map((r) => r.match_id as string);
      if (ids.length === 0) break;
      const { error } = await db.from('match_cache').delete().in('match_id', ids);
      if (error) break;
      deleted += ids.length;
      if (ids.length < BATCH) break;
      await new Promise((r) => setTimeout(r, 200)); // 체크포인트 숨돌리기
    }
    retention.match_cache_deleted = deleted;
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

  // search_log — sitemap 은 최근 500개만 쓴다. 오래 방치된 닉네임은 색인 가치가 없다.
  try {
    const cutoff = new Date(Date.now() - 180 * day).toISOString();
    const { count } = await db
      .from('search_log')
      .delete({ count: 'estimated' })
      .lt('last_seen', cutoff);
    retention.search_log_deleted = count ?? 0;
  } catch {
    retention.search_log_deleted = -1;
  }

  // user_snapshots — 마이페이지는 최근 14개만 읽는다(스파크라인).
  try {
    const cutoff = new Date(Date.now() - 180 * day).toISOString().slice(0, 10);
    const { count } = await db
      .from('user_snapshots')
      .delete({ count: 'estimated' })
      .lt('snapshot_date', cutoff);
    retention.user_snapshots_deleted = count ?? 0;
  } catch {
    retention.user_snapshots_deleted = -1;
  }

  // app_events — 앱 익명 사용 기록. 재방문·공유 통계는 최근 30일 위주로 본다.
  // match_cache 와 같은 이유로 한 번에 지우지 않는다(WAL 폭증). id(identity) 구간으로 잘라
  // 한 문장이 최대 BATCH 행만 건드리게 하고, 실행당 반복 상한을 둬 며칠에 걸쳐 수렴시킨다.
  // (in(id 목록) 대신 구간을 쓰는 건 5,000개 id 가 URL 에 실리지 않게 하기 위해서다.)
  try {
    const cutoff = new Date(Date.now() - 180 * day).toISOString();
    const BATCH = 5_000;
    const MAX_ITER = 20;
    let deleted = 0;
    for (let i = 0; i < MAX_ITER; i++) {
      const { data: edge, error: edgeErr } = await db
        .from('app_events')
        .select('id')
        .lt('created_at', cutoff)
        .order('id', { ascending: true })
        .limit(1);
      if (edgeErr || !edge?.length) break;
      const lo = Number(edge[0].id);
      const { count, error } = await db
        .from('app_events')
        .delete({ count: 'exact' })
        .gte('id', lo)
        .lt('id', lo + BATCH)
        .lt('created_at', cutoff);
      if (error) break;
      deleted += count ?? 0;
      await new Promise((r) => setTimeout(r, 200)); // 체크포인트 숨돌리기
    }
    retention.app_events_deleted = deleted;
  } catch {
    retention.app_events_deleted = -1;
  }

  return Response.json({ ok: true, warmed: summary, retention });
}
