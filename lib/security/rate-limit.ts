import 'server-only';

/**
 * 비로그인 넥슨 팬아웃 경로용 소프트 IP rate limit.
 *
 * 회의 R4 반영:
 * - Vercel 서버리스라 인스턴스별 in-memory. 크로스-인스턴스 완벽 제한이 목적이 아니라,
 *   스크립터 한 명이 한 인스턴스를 두들길 때 그 자리에서 막는 게 목적. 백스톱은 넥슨 kill-switch.
 * - 한국 이통사 CGNAT/학교·회사 공유 IP 오검출을 감안해 임계를 관대하게 잡는다.
 * - IP는 신뢰 헤더(x-real-ip, Vercel 주입) 우선. x-forwarded-for는 클라이언트 위조 가능하므로 폴백.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

// 경로 그룹별 독립 버킷맵. 메모리 누수 방지를 위해 만료 엔트리는 조회 시 정리.
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Vercel 신뢰 헤더 우선으로 클라이언트 IP 추출. */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // 초
}

/**
 * @param bucketKey 경로 그룹 + IP 조합 키
 * @param limit 창당 허용 횟수
 * @param windowMs 창 길이(ms)
 */
export function rateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // 주기적 스윕(최대 60초마다) — 만료 버킷 제거로 무한 성장 방지
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }

  const b = buckets.get(bucketKey);
  if (!b || b.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** 넥슨 팬아웃(무거운 조회) 기본 정책: IP당 분당 40회. CGNAT 감안해 관대. */
export function limitNexonFanout(headers: Headers, group: string): RateLimitResult {
  const ip = clientIp(headers);
  return rateLimit(`${group}:${ip}`, 40, 60_000);
}
