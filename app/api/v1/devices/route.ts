import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { apiError, ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/devices — APNs 토큰 등록/갱신 (앱 시작·로그인·즐겨찾기 변경 시).
 * 로그인 상태면 user_id 를 연결해 '내 글 새 댓글' 알림 대상이 된다.
 */
export async function POST(req: Request) {
  let body: { token?: unknown; platform?: unknown; nickname?: unknown; favorites?: unknown; appVersion?: unknown; weekly?: unknown; meta?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError('bad_request', '잘못된 요청', 400);
  }
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
  const favorites = Array.isArray(body.favorites) ? body.favorites.filter((f): f is string => typeof f === 'string').slice(0, 12) : [];
  const { error } = await db.from('device_tokens').upsert(
    {
      token,
      platform: body.platform === 'ios' ? 'ios' : 'ios',
      user_id: userId,
      nickname: typeof body.nickname === 'string' ? body.nickname.slice(0, 40) : null,
      favorites,
      app_version: typeof body.appVersion === 'string' ? body.appVersion.slice(0, 20) : null,
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
