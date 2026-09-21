import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin-auth';

/**
 * 작성자 id → 운영자 여부. ADMIN_EMAILS 에 있는 계정이 쓴 글·댓글에 "운영자" 배지를 붙인다
 * (제목에 "[운영자]"를 손으로 적는 대신 — 2026-09-22 운영자 요청).
 * 이메일은 auth.users 에만 있어 service_role 로 조회하고, 결과는 인스턴스 메모리에 1시간 캐시한다
 * (작성자 수는 적고 운영자 여부는 거의 바뀌지 않는다).
 */
const TTL_MS = 3_600_000;
const cache = new Map<string, { at: number; op: boolean }>();

export async function getOperatorIds(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const uniq = [...new Set(ids)].filter(Boolean);
  if (uniq.length === 0 || !process.env.ADMIN_EMAILS) return out;
  const admin = getAdmin();
  if (!admin) return out;
  const now = Date.now();
  await Promise.all(
    uniq.map(async (id) => {
      const hit = cache.get(id);
      if (hit && now - hit.at < TTL_MS) {
        if (hit.op) out.add(id);
        return;
      }
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        const op = isAdminEmail(data.user?.email);
        cache.set(id, { at: now, op });
        if (op) out.add(id);
      } catch {
        // 조회 실패 → 배지 없이 표시(글 자체는 정상)
      }
    })
  );
  return out;
}
