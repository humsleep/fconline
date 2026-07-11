import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { shortId } from '@/lib/community/posts';

const BODY_MAX = 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.nickname)
    return NextResponse.json(
      { error: '먼저 커뮤니티 닉네임을 등록하세요.' },
      { status: 403 }
    );

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const body = String(payload.body ?? '').trim();
  if (!body)
    return NextResponse.json({ error: '내용을 입력하세요.' }, { status: 400 });
  if (body.length > BODY_MAX)
    return NextResponse.json({ error: '댓글이 너무 깁니다.' }, { status: 400 });

  const rawSquad = payload.squad_id ? String(payload.squad_id).trim() : '';
  const squad_id = /^[a-zA-Z0-9]{1,32}$/.test(rawSquad) ? rawSquad : null;

  const id = shortId();
  const { error } = await supabase.from('community_comments').insert({
    id,
    post_id: postId,
    author_id: user.id,
    body,
    squad_id,
  });

  if (error) {
    if (error.code === '23503')
      return NextResponse.json({ error: '삭제된 글입니다.' }, { status: 404 });
    if (error.code === '42P01')
      return NextResponse.json(
        { error: '댓글 테이블이 없습니다. 마이그레이션(0007)을 실행하세요.' },
        { status: 500 }
      );
    return NextResponse.json({ error: '등록에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let commentId = '';
  try {
    const body = await request.json();
    commentId = String(body?.comment_id ?? '');
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (!commentId)
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  // RLS가 작성자 본인만 삭제 허용 — 조건 불일치 시 0행 삭제
  const { error } = await supabase
    .from('community_comments')
    .delete()
    .eq('id', commentId)
    .eq('post_id', postId)
    .eq('author_id', user.id);

  if (error)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
