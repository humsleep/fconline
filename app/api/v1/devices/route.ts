import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { apiError, ok } from '@/lib/api/v1';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { cleanDeviceText, sanitizeFavorites } from '@/lib/push/device-input';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/devices — APNs 토큰 등록/갱신 (앱 시작·로그인·즐겨찾기 변경 시).
 * 로그인 상태면 user_id 를 연결해 '내 글 새 댓글' 알림 대상이 된다.
 * 공개 쓰기 경로라 IP당 분당 20회(앱은 시작·로그인·즐겨찾기 변경 때만 부른다).
 */
export async function POST(req: Request) {
  const rl = rateLimit(`devices:${clientIp(req.headers)}`, 20, 60_000);
  if (!rl.ok) return apiError('rate_limited', '잠시 후 다시 시도해 주세요.', 429, { 'Retry-After': String(rl.retryAfter) });

  let body: { token?: unknown; platform?: unknown; nickname?: unknown; favorites?: unknown; appVersion?: unknown; weekly?: unknown; meta?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError('bad_request', '잘못된 요청', 400);
  }
  if (!body || typeof body !== 'object') return apiError('bad_request', '잘못된 요청', 400);
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!/^[0-9a-f]{32,200}$/i.test(token)) return apiError('bad_request', '잘못된 토큰', 400);
  const db = getAdmin();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // 미설정 — 익명 등록
  }
  const { error } = await db.from('device_tokens').upsert(
    {
      token,
      platform: 'ios',
      user_id: userId,
      nickname: cleanDeviceText(body.nickname),
      favorites: sanitizeFavorites(body.favorites),
      app_version: cleanDeviceText(body.appVersion, 20),
      ...(typeof body.weekly === 'boolean' ? { weekly_opt: body.weekly } : {}),
      ...(typeof body.meta === 'boolean' ? { meta_opt: body.meta } : {}),
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'token' }
  );
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return ok({ ok: true });
}

/** DELETE /api/v1/devices — 알림 끄기(토큰 삭제) */
export async function DELETE(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const db = getAdmin();
  if (!db || !token) return NextResponse.json({ ok: false }, { status: 400 });
  await db.from('device_tokens').delete().eq('token', token);
  return ok({ ok: true });
}
