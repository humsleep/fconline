import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function requireOwner(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, owns: false };
  const { data } = await supabase
    .from('community_posts')
    .select('author_id')
    .eq('id', id)
    .maybeSingle();
  return { supabase, user, owns: data?.author_id === user.id };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, owns } = await requireOwner(id);
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!owns)
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  let status = 'open';
  try {
    const body = await request.json();
    status = body?.status === 'closed' ? 'closed' : 'open';
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('community_posts')
    .update({ status })
    .eq('id', id);
  if (error)
    return NextResponse.json({ error: '변경에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, owns } = await requireOwner(id);
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!owns)
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const { error } = await supabase.from('community_posts').delete().eq('id', id);
  if (error)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
