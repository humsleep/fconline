import { getOuid, getUserMatches } from '@/lib/nexon/api';
import { getMatchDetailsBatch } from '@/lib/nexon/cached';
import {
  NexonApiError,
  isMaintenance,
  isNotConfigured,
  isPaused,
  isUserNotFound,
} from '@/lib/nexon/client';
import { summarizeMatch, type MatchSummary } from '@/lib/nexon/summary';
import { MATCH_TABS } from '@/lib/nexon/meta';
import { limitNexonFanout } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const LIVE_COUNT = 12;

// 라이브 세션 폴링용 — 최근 경기 요약을 JSON으로. 넥슨 미반영/지연은 빈 목록으로 흡수.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ nickname: string }> }
) {
  const rl = limitNexonFanout(req.headers, 'live');
  if (!rl.ok)
    return Response.json(
      { ok: false, reason: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );

  const { nickname } = await params;
  const typeParam = Number(new URL(req.url).searchParams.get('type'));
  const matchType =
    MATCH_TABS.find((t) => t.type === typeParam)?.type ?? MATCH_TABS[0].type;

  try {
    let decoded: string;
    try {
      decoded = decodeURIComponent(nickname);
    } catch {
      return Response.json({ ok: false, reason: 'bad_request' }, { status: 400 });
    }

    const ouid = await getOuid(decoded);
    let ids: string[] = [];
    let listOk = true;
    try {
      ids = await getUserMatches(ouid, matchType, LIVE_COUNT);
    } catch (err) {
      if (!(err instanceof NexonApiError)) throw err;
      // 매치리스트 조회 실패 — 빈 목록과 구분되도록 listOk=false
      listOk = false;
    }
    const details = await getMatchDetailsBatch(ids);
    const matches: MatchSummary[] = [];
    for (const d of details) {
      const s = summarizeMatch(d, ouid);
      if (s) matches.push(s);
    }
    // 같은 (닉네임,타입) 동시 폴링을 CDN에서 흡수 (넥슨 부하 완화)
    return Response.json(
      { ok: true, ouid, matchType, matches, listOk },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=45' } }
    );
  } catch (err) {
    if (isUserNotFound(err)) {
      return Response.json({ ok: false, reason: 'not_found' }, { status: 404 });
    }
    if (isNotConfigured(err)) {
      return Response.json({ ok: false, reason: 'not_configured' }, { status: 503 });
    }
    if (isMaintenance(err)) {
      return Response.json({ ok: false, reason: 'maintenance' }, { status: 503 });
    }
    if (isPaused(err)) {
      return Response.json({ ok: false, reason: 'paused' }, { status: 503 });
    }
    return Response.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}
