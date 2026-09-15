import { getAdmin } from '@/lib/supabase/admin';
import { apiError, ok } from '@/lib/api/v1';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { sanitizeEvents } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/events — 앱 익명 사용 기록(배치). 계정 정보는 받지 않는다.
 *
 * 측정은 앱 기능이 아니다: DB 가 없거나 저장이 실패해도 앱에는 200 을 돌려준다 —
 * 통계가 빠지는 게 사용자에게 에러가 보이는 것보다 낫다. 대신 accepted 로 실제 저장 수를 알린다.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`events:${clientIp(req.headers)}`, 30, 60_000);
  if (!rl.ok) return apiError('rate_limited', '잠시 후 다시 시도해 주세요.', 429, { 'Retry-After': String(rl.retryAfter) });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('bad_request', '잘못된 요청', 400);
  }
  const batch = sanitizeEvents(raw);
  if (!batch) return apiError('bad_request', '잘못된 요청', 400);
  if (batch.events.length === 0) return ok({ ok: true, accepted: 0 });

  const db = getAdmin();
  if (!db) return ok({ ok: true, accepted: 0 });
  const rows = batch.events.map((e) => ({
    install_id: batch.installId,
    event: e.name,
    props: e.props,
    app_version: batch.appVersion,
    env: batch.env,
    created_at: e.at,
  }));
  try {
    const { error } = await db.from('app_events').insert(rows);
    return ok({ ok: true, accepted: error ? 0 : rows.length });
  } catch {
    return ok({ ok: true, accepted: 0 });
  }
}
