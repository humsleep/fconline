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

    const top = [...freq.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, TOP_PLAYERS)
      .map((p) => ({ id: p.id, po: p.po }));

    const warmed = await getRankerStatsCached(matchtype, top);
    summary[`type_${matchtype}`] = warmed.size;
  }

  return Response.json({ ok: true, warmed: summary });
}
