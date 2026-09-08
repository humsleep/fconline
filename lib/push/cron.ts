import 'server-only';
import { getAdmin } from '@/lib/supabase/admin';
import { isDeadToken, sendPush, type PushPayload } from './apns';

/** 크론 인증 — CRON_SECRET fail-closed (기존 ranker-snapshot 과 동일 정책) */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

interface DeviceRow { token: string; nickname: string | null; user_id: string | null; favorites: string[]; weekly_opt: boolean; meta_opt: boolean }

export async function loadDevices(filter: 'weekly' | 'meta'): Promise<DeviceRow[]> {
  const db = getAdmin();
  if (!db) return [];
  let q = db.from('device_tokens').select('token, nickname, user_id, favorites, weekly_opt, meta_opt').eq('platform', 'ios').limit(5000);
  q = filter === 'weekly' ? q.eq('weekly_opt', true).not('nickname', 'is', null) : q.eq('meta_opt', true);
  const { data } = await q;
  return (data as DeviceRow[]) ?? [];
}

/** 토큰 그룹별 발송 + 무효 토큰 정리. 반환: 발송/실패/삭제 수 */
export async function dispatch(groups: { tokens: string[]; payload: PushPayload }[]) {
  const db = getAdmin();
  let sent = 0, failed = 0, removed = 0;
  for (const g of groups) {
    const results = await sendPush(g.tokens, g.payload);
    const dead = results.filter(isDeadToken).map((r) => r.token);
    sent += results.filter((r) => r.status === 200).length;
    failed += results.filter((r) => r.status !== 200).length;
    if (db && dead.length) {
      await db.from('device_tokens').delete().in('token', dead);
      removed += dead.length;
    }
  }
  return { sent, failed, removed };
}
