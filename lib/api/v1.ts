import 'server-only';
import { NextResponse } from 'next/server';
import {
  isMaintenance,
  isNotConfigured,
  isPaused,
  isRateLimited,
  isTimeout,
  isUserNotFound,
} from '@/lib/nexon/client';
import { limitNexonFanout } from '@/lib/security/rate-limit';

/**
 * /api/v1 — iOS 네이티브 앱용 JSON API 공용 헬퍼.
 * 화면(SSR)과 같은 lib 함수를 재사용하고, 넥슨 오류를 앱이 분기할 수 있는 code 로 매핑한다.
 */

export interface ApiError {
  error: string;
  code:
    | 'user_not_found'
    | 'not_configured'
    | 'maintenance'
    | 'paused'
    | 'rate_limited'
    | 'timeout'
    | 'upstream'
    | 'bad_request'
    | 'not_found';
}

export function apiError(code: ApiError['code'], error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error, code } satisfies ApiError, { status, headers });
}

/** 넥슨 오류 → HTTP 응답. */
export function nexonErrorResponse(err: unknown, nickname?: string) {
  if (isUserNotFound(err))
    return apiError('user_not_found', nickname ? `‘${nickname}’ 구단주를 찾을 수 없어요.` : '구단주를 찾을 수 없어요.', 404);
  if (isNotConfigured(err)) return apiError('not_configured', '넥슨 API 연동 설정이 완료되지 않았어요.', 503);
  if (isMaintenance(err)) return apiError('maintenance', '넥슨 API 점검 중이에요. 잠시 후 다시 시도해 주세요.', 503);
  if (isPaused(err)) return apiError('paused', '전적 조회를 잠시 멈췄어요. 곧 다시 열립니다.', 503);
  if (isRateLimited(err)) return apiError('rate_limited', '요청이 많아요. 잠시 후 다시 시도해 주세요.', 429);
  if (isTimeout(err)) return apiError('timeout', '넥슨 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.', 504);
  return apiError('upstream', '데이터를 불러오지 못했어요.', 502);
}

/** IP rate limit — 초과 시 429 응답, 통과 시 null. */
export function fanoutGuard(req: Request, group: string) {
  const rl = limitNexonFanout(req.headers, group);
  if (rl.ok) return null;
  return apiError('rate_limited', '잠시 후 다시 시도해 주세요. 요청이 너무 많아요.', 429, {
    'Retry-After': String(rl.retryAfter),
  });
}

/** 경로 파라미터 닉네임 디코드 (잘못된 % 시퀀스는 원문 유지). */
export function decodeNickname(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/** 룰 객체에서 함수(when) 제거 — 직렬화용. */
export function serializeRule<T extends { when?: unknown }>(r: T | null | undefined) {
  if (!r) return null;
  const { when: _when, ...rest } = r;
  void _when;
  return rest;
}

export function ok<T>(data: T, cacheSeconds = 0) {
  return NextResponse.json(data, {
    headers: cacheSeconds > 0 ? { 'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=60` } : { 'Cache-Control': 'no-store' },
  });
}
