import 'server-only';
import { getAdmin } from '@/lib/supabase/admin';
import { isDeadToken, sendPush, type PushPayload, type PushResult } from './apns';
import { deadTokenDecision } from './policy';

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
  // 상한(5000)을 넘으면 최근에 앱을 연 기기부터 — 순서 없이 자르면 활성 사용자가 빠질 수 있다.
  // last_seen 은 /api/v1/devices upsert 가 매번 갱신한다.
  let q = db
    .from('device_tokens')
    .select('token, nickname, user_id, favorites, weekly_opt, meta_opt')
    .eq('platform', 'ios')
    .order('last_seen', { ascending: false })
    .limit(5000);
  q = filter === 'weekly' ? q.eq('weekly_opt', true).not('nickname', 'is', null) : q.eq('meta_opt', true);
  const { data } = await q;
  return (data as DeviceRow[]) ?? [];
}

/** PostgREST `in` 필터는 URL 에 실리므로 토큰 목록을 잘라 지운다. */
const DELETE_CHUNK = 100;

/**
 * 토큰 그룹별 발송 + 무효 토큰 정리.
 * 삭제 여부는 **실행 전체**로 판단한다(주간 리캡은 그룹당 토큰 1~2개라 그룹 단위로는 브레이커가 안 걸린다).
 * 반환: 발송/실패/삭제 수 + 브레이커로 삭제를 건너뛴 무효 토큰 수.
 */
export async function dispatch(groups: { tokens: string[]; payload: PushPayload }[]) {
  const db = getAdmin();
  const all: PushResult[] = [];
  for (const g of groups) {
    all.push(...(await sendPush(g.tokens, g.payload)));
  }
  const sent = all.filter((r) => r.status === 200).length;
  const failed = all.length - sent;
  const dead = [...new Set(all.filter(isDeadToken).map((r) => r.token))];
  const decision = deadTokenDecision(all.length, dead.length);

  let removed = 0;
  if (decision.tripped) {
    console.warn(`[push] dead-token breaker tripped: ${dead.length}/${all.length} — 삭제 건너뜀(APNS_SANDBOX·APNS_BUNDLE_ID·키 확인)`);
  } else if (db && decision.delete) {
    for (let i = 0; i < dead.length; i += DELETE_CHUNK) {
      const chunk = dead.slice(i, i + DELETE_CHUNK);
      const { error } = await db.from('device_tokens').delete().in('token', chunk);
      if (!error) removed += chunk.length;
    }
  }
  return {
    sent,
    failed,
    removed,
    deadSkipped: decision.tripped ? dead.length : 0,
    breakerTripped: decision.tripped,
  };
}
