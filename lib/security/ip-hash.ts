import 'server-only';

import { createHash } from 'crypto';

/**
 * IP를 평문 저장하지 않기 위한 해시.
 * 솔트: IP_HASH_SALT(권장) → 없으면 SUPABASE_SERVICE_ROLE_KEY에서 파생(서버 전용 비밀이라 안전).
 * 둘 다 없으면 null → 호출부는 rate limit 없이 동작(로컬 개발 폴백).
 */
function salt(): string | null {
  const explicit = process.env.IP_HASH_SALT;
  if (explicit && explicit.length >= 16) return explicit;
  const derived = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (derived) return createHash('sha256').update(`fcscope:${derived}`).digest('hex');
  return null;
}

export function hashIp(ip: string): string | null {
  const s = salt();
  if (!s || !ip) return null;
  return createHash('sha256').update(`${s}:${ip}`).digest('hex');
}

/**
 * 프록시 뒤 실제 클라이언트 IP.
 * x-real-ip(Vercel 주입, 위조 불가) 우선 — x-forwarded-for 첫 항목은 클라이언트가
 * 위조할 수 있어 폴백으로만 사용(rate-limit.ts의 clientIp와 동일 정책).
 */
export function clientIpFrom(headers: Headers): string {
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '';
}
