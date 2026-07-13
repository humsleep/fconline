import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';

/**
 * 넥슨 kill-switch — 운영자가 /admin에서 배포 없이 넥슨 팬아웃을 즉시 정지/재개.
 * service_flags.nexon_paused(0013) 플래그를 인스턴스별 30초 캐시로 읽는다.
 *
 * 설계 원칙(회의 R4 반영):
 * - 넥슨 큐 '진입 전'에만 검사 → 순차 큐의 임계경로에 Supabase 왕복을 넣지 않는다.
 * - fail-OPEN → Supabase 순단이 넥슨 호출 전체를 죽이는 새 SPOF가 되지 않게 한다.
 * - manual 단일 플래그만(자동 429 백오프는 크론 자가치유를 역회전시킬 수 있어 제외).
 */

const TTL_MS = 30_000;
let cached: { paused: boolean; at: number } | null = null;

/** 캐시된 일시정지 상태. 실패/미설정 시 false(허용). */
export async function isNexonPaused(): Promise<boolean> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.paused;

  let paused = cached?.paused ?? false; // 조회 실패 시 마지막 알려진 값 유지(초기엔 false)
  try {
    const db = getAdmin();
    if (db) {
      const { data } = await db
        .from('service_flags')
        .select('enabled')
        .eq('key', 'nexon_paused')
        .maybeSingle();
      paused = Boolean(data?.enabled);
    }
  } catch {
    // fail-open: 플래그를 못 읽으면 넥슨 호출을 막지 않는다.
  }
  cached = { paused, at: now };
  return paused;
}

/** 플래그 변경 직후 즉시 반영되도록 인스턴스 캐시 무효화(관리 API에서 호출). */
export function invalidatePauseCache(): void {
  cached = null;
}
