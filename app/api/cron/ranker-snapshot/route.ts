import { getAdmin } from '@/lib/supabase/admin';
import { getRankerStatsCached, kstToday, rankerKey } from '@/lib/nexon/ranker';
import { getRankerStats } from '@/lib/nexon/api';
import { unpackMatchDetail } from '@/lib/nexon/pack';
import { popularCombosCounted } from '@/lib/nexon/popular-combos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 스냅샷 대상 매치 종류 (공식경기 / 감독모드)
const MATCH_TYPES = [50, 52];
const RECENT_MATCHES = 400; // 인기 집계에 쓸 최근 캐시 매치 수
const TOP_PLAYERS = 80; // 매치 종류별 예열할 선수×포지션 조합 수(라인당 20 — 넥슨 4콜)

const DAY = 24 * 60 * 60 * 1000;
/**
 * match_cache 보관기간. 90일 → 30일(2026-09-04) → **14일**(2026-10-06).
 * 30일 보관으로 무료 한도 500MB 를 넘었다(522MB). 소비처는 최근 경기만 본다 —
 * 전적 화면은 최근 30경기, 이 크론은 최근 400경기. 오래된 경기는 조회 시 넥슨에서 다시 채워진다.
 */
const MATCH_CACHE_RETENTION_DAYS = 14;
/** 한 문장이 지우는 구간 폭. 하루치 = 대략 수천 행(WAL 수십 MB) — 한 번에 몰아 지우지 않기 위한 단위. */
const PRUNE_WINDOW = DAY;
/** 실행당 최대 구간 수. 구간 1개 = 외부 호출 2개(가장 오래된 행 조회 + 삭제). 밀린 분량은 며칠에 걸쳐 수렴. */
const PRUNE_MAX_WINDOWS = 7;

/**
 * match_cache 보관기간 정리 — match_date 구간 삭제.
 *
 * 예전 방식(id 5,000개 select → `.in('match_id', ids)` delete)은 실제로 거의 지우지 못했다.
 *  - Supabase API 는 select 를 최대 1,000행까지만 준다(max_rows) → `ids.length < BATCH` 로 첫 바퀴에 종료.
 *    즉 하루 최대 1,000행만 지웠다. 하루 유입이 그보다 많으면 테이블은 계속 자란다.
 *  - id 1,000개(약 25KB)를 URL 쿼리스트링에 싣는 것 자체가 게이트웨이 URL 길이 한도에 걸릴 수 있다.
 *
 * 지금은 "가장 오래된 match_date 부터 하루씩" `match_date < hi` 로 지운다. URL 이 짧고 행 수 제한이 없으며,
 * 오래된 쪽부터 지우므로 띄엄띄엄한 옛 경기(휴면 구단주 조회분)가 있어도 빈 구간을 헛돌지 않는다.
 * 평상시(밀린 분량 없음)엔 구간 1개로 끝난다 — 조회 1 + 삭제 1.
 * (match_cache_type_date_idx 는 match_type 이 선두라 match_date 단독 조건엔 못 쓴다. 테이블 스캔이지만
 *  하루 1회·보관기간이 짧아 감수한다. 인덱스를 더 두면 경기 저장마다 쓰기가 는다.)
 *
 * @returns 지운 행 수. 첫 조회부터 실패하면 -1.
 */
async function pruneMatchCache(db: NonNullable<ReturnType<typeof getAdmin>>): Promise<number> {
  const cutoff = Date.now() - MATCH_CACHE_RETENTION_DAYS * DAY;
  let deleted = 0;
  try {
    for (let i = 0; i < PRUNE_MAX_WINDOWS; i++) {
      const { data: oldest, error: oldestErr } = await db
        .from('match_cache')
        .select('match_date')
        .order('match_date', { ascending: true })
        .limit(1);
      if (oldestErr) return i === 0 ? -1 : deleted;
      if (!oldest?.length) break;
      const lo = new Date(oldest[0].match_date as string).getTime();
      if (!(lo < cutoff)) break; // 보관기간 안쪽만 남음 — 끝
      const hi = Math.min(lo + PRUNE_WINDOW, cutoff);
      const { count, error } = await db
        .from('match_cache')
        .delete({ count: 'exact' })
        .lt('match_date', new Date(hi).toISOString());
      if (error) return i === 0 ? -1 : deleted;
      deleted += count ?? 0;
      if (hi === cutoff) break; // 보관기간 경계까지 지웠다 — 남은 건 전부 보관 대상
      await new Promise((r) => setTimeout(r, 200)); // 체크포인트 숨돌리기
    }
  } catch {
    return deleted > 0 ? deleted : -1;
  }
  return deleted;
}

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

  // 보관기간 정리를 예열보다 **먼저** 한다. 예열은 넥슨·DB 호출이 많고 CPU 를 쓰는 구간이라,
  // 뒤에 두면 Workers 한도(CPU·외부 호출 50개)에 먼저 걸려 정리가 아예 실행되지 않을 수 있다.
  const matchCacheDeleted = await pruneMatchCache(db);

  const summary: Record<string, number> = {};
  const probes: Record<string, string> = {};

  for (const matchtype of MATCH_TYPES) {
    let rows: { payload: unknown }[] = [];
    try {
      const { data } = await db
        .from('match_cache')
        .select('payload')
        .eq('match_type', matchtype)
        .order('match_date', { ascending: false })
        .limit(RECENT_MATCHES);
      rows = (data as { payload: unknown }[]) ?? [];
    } catch {
      summary[`type_${matchtype}`] = -1;
      continue;
    }

    // payload 는 배열 패킹 저장이다(lib/nexon/pack.ts, 2026-09-08~). 예전엔 row.payload.matchInfo 를
    // 바로 읽어 패킹 행에서 항상 undefined → 조합 0개 → 랭커 예열이 직전 스냅샷 폴백에만 의존했다.
    let top: { id: number; po: number; n?: number }[] = popularCombosCounted(
      rows.map((r) => unpackMatchDetail(r.payload)),
      TOP_PLAYERS
    );

    // 폴백: match_cache가 비면(콜드스타트) 직전 스냅샷의 조합을 재예열
    // → 한 번 시딩되면 검색이 없어도 랭킹이 매일 갱신·유지된다.
    if (top.length === 0) {
      try {
        const { data: prev } = await db
          .from('ranker_stats_snapshot')
          .select('sp_id, sp_position, snapshot_date, payload')
          .eq('match_type', matchtype)
          .is('payload->empty', null)
          .order('snapshot_date', { ascending: false })
          .limit(TOP_PLAYERS * 3);
        const seen = new Set<string>();
        const combos: { id: number; po: number; n?: number }[] = [];
        for (const r of prev ?? []) {
          const key = rankerKey(r.sp_id as number, r.sp_position as number);
          if (seen.has(key)) continue;
          seen.add(key);
          // 전날 usage 를 오늘 값으로 옮기지 않는다(순위가 고정되고 "오늘 스냅샷"처럼 보였다). 예열만 한다.
          combos.push({ id: r.sp_id as number, po: r.sp_position as number });
          if (combos.length >= TOP_PLAYERS) break;
        }
        top = combos;
      } catch {
        // 폴백 실패 시 이번 타입은 건너뜀
      }
    }

    // 진단 프로브: getRankerStatsCached 는 넥슨 에러를 삼킨다(tombstone 오염 방지). 결과가 계속 비어
    // 원인을 알 수 없었으므로 인기 조합 1개로 한 번 직접 불러 응답 개수/에러 코드를 남긴다(넥슨 1콜).
    if (top.length > 0) {
      try {
        const probe = await getRankerStats(matchtype, top.slice(0, 1));
        probes[`type_${matchtype}`] = `ok:${probe.length}`;
      } catch (err) {
        const e = err as { name?: string; status?: number; code?: string; message?: string };
        probes[`type_${matchtype}`] = `err:${e.status ?? '?'}:${e.code ?? e.name ?? '?'}:${(e.message ?? '').slice(0, 120)}`;
      }
    }

    const warmed = await getRankerStatsCached(matchtype, top);

    // 사용 횟수(usage)를 오늘 스냅샷에 붙인다 — 픽 랭킹은 이 값으로 정렬한다(lib/meta/picks.ts).
    // 유저 조회 중에 저장된 행(usage 없음)은 인기 순위에서 빠진다.
    const usageRows = top
      .filter((c) => typeof c.n === 'number' && c.n > 0 && warmed.has(rankerKey(c.id, c.po)))
      .map((c) => ({
        match_type: matchtype,
        sp_id: c.id,
        sp_position: c.po,
        snapshot_date: kstToday(),
        payload: { ...warmed.get(rankerKey(c.id, c.po))!, usage: c.n },
      }));
    if (usageRows.length > 0) {
      // supabase-js 는 throw 하지 않고 { error } 를 준다 — 실패를 요약에 남긴다.
      const { error } = await db
        .from('ranker_stats_snapshot')
        .upsert(usageRows, { onConflict: 'match_type,sp_id,sp_position,snapshot_date' });
      summary[`usage_${matchtype}`] = error ? -1 : usageRows.length;
    } else {
      summary[`usage_${matchtype}`] = 0;
    }
    summary[`type_${matchtype}`] = warmed.size;
    // 진단용: 조합 수(0 이면 match_cache/폴백 문제) vs 실데이터 수(0 이면 넥슨 ranker-stats 응답 문제)
    summary[`combos_${matchtype}`] = top.length;
    summary[`cache_rows_${matchtype}`] = rows.length;
  }

  // 보관기간 정리 — 캐시 테이블 무한 증가 방지(Disk + 무료 500MB 한도 + IO).
  // 핫패스는 최근 매치/스냅샷만 읽으므로 오래된 행은 삭제해도 안전
  // (오래된 매치는 조회 시 넥슨에서 재캐시됨). best-effort, 실패해도 크론 성공.
  const retention: Record<string, number> = {};
  const day = DAY;
  // match_cache 는 핸들러 맨 앞에서 이미 정리했다(pruneMatchCache).
  retention.match_cache_deleted = matchCacheDeleted;
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

  // Vercel 로그에서 바로 볼 수 있게 남긴다(비밀값 없음).
  console.log('[ranker-snapshot]', JSON.stringify({ warmed: summary, probes }));
  return Response.json({ ok: true, warmed: summary, probes, retention });
}
