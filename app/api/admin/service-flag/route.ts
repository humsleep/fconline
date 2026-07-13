import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin-auth';
import { invalidatePauseCache } from '@/lib/nexon/pause';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isAdminEmail(user.email) ? user : null;
}

/** 넥슨 kill-switch 토글 — { key: 'nexon_paused', enabled: boolean } */
export async function POST(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  const db = getAdmin();
  if (!db)
    return NextResponse.json({ error: '설정이 필요합니다.' }, { status: 503 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const key = String(payload.key ?? '');
  if (key !== 'nexon_paused')
    return NextResponse.json({ error: '알 수 없는 플래그입니다.' }, { status: 400 });
  const enabled = Boolean(payload.enabled);

  const { error } = await db
    .from('service_flags')
    .upsert(
      { key, enabled, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error)
    return NextResponse.json({ error: '변경에 실패했습니다.' }, { status: 500 });

  // 이 인스턴스는 즉시 반영, 다른 인스턴스는 최대 30초(캐시 TTL) 내 반영
  invalidatePauseCache();
  return NextResponse.json({ ok: true, enabled });
}
