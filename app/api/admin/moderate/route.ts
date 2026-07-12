import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin-auth';

/** 운영자 조치: 글/댓글 숨김·해제·삭제. 관리자 인증 후 service_role로 실행. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email))
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

  const targetType = String(payload.target_type ?? '');
  const targetId = String(payload.target_id ?? '').slice(0, 32);
  const action = String(payload.action ?? '');
  if (
    !['post', 'comment'].includes(targetType) ||
    !targetId ||
    !['hide', 'unhide', 'delete'].includes(action)
  )
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  const table = targetType === 'post' ? 'community_posts' : 'community_comments';
  const { error } =
    action === 'delete'
      ? await db.from(table).delete().eq('id', targetId)
      : await db
          .from(table)
          .update({ hidden: action === 'hide' })
          .eq('id', targetId);

  if (error)
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
