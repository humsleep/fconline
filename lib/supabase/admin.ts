import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// service_role 클라이언트 — RLS를 우회하므로 서버 코드에서만 import 할 것.
// 환경변수 미설정 시 null 반환 → 호출부는 캐시 없이 동작(graceful degradation).
let cached: SupabaseClient | null | undefined;

export function getAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cached =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  return cached;
}
