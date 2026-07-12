import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const REASONS = new Set(['spam', 'abuse', 'illegal', 'other']);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const targetType = String(payload.target_type ?? '');
  const targetId = String(payload.target_id ?? '').slice(0, 32);
  const reason = String(payload.reason ?? '');

  if (!['post', 'comment'].includes(targetType) || !targetId || !REASONS.has(reason))
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
  });

  if (error) {
    if (error.code === '23505')
      return NextResponse.json(
        { error: '이미 신고한 게시물이에요.' },
        { status: 409 }
      );
    if (error.code === '42P01')
      return NextResponse.json(
        { error: '신고 기능이 아직 준비되지 않았어요.' },
        { status: 500 }
      );
    return NextResponse.json({ error: '신고에 실패했어요.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
