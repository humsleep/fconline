import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin-auth';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isAdminEmail(user.email) ? user : null;
}

/** 새 공지 등록 — 기존 활성 공지는 자동 비활성(한 번에 하나만). */
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
  const text = String(payload.text ?? '').trim().slice(0, 200);
  const rawLink = payload.link ? String(payload.link).trim() : '';
  // 내부 경로만 허용
  const link = rawLink.startsWith('/') && !rawLink.startsWith('//') ? rawLink : null;
  if (!text)
    return NextResponse.json({ error: '공지 내용을 입력하세요.' }, { status: 400 });

  await db.from('notices').update({ active: false }).eq('active', true);
  const { error } = await db.from('notices').insert({ text, link, active: true });
  if (error)
    return NextResponse.json({ error: '등록에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** 공지 내리기 */
export async function DELETE() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  const db = getAdmin();
  if (!db)
    return NextResponse.json({ error: '설정이 필요합니다.' }, { status: 503 });
  const { error } = await db.from('notices').update({ active: false }).eq('active', true);
  if (error)
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
