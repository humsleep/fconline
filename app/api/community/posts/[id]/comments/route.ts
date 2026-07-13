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

  // 작성 간격 제한 사전 체크(10초) — RLS(0013)와 이중 방어.
  const { data: recent } = await supabase
    .from('community_comments')
    .select('created_at')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < 10_000)
    return NextResponse.json(
      { error: '조금 천천히요! 댓글은 10초에 한 번 달 수 있어요.' },
      { status: 429 }
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
    if (error.code === '42501')
      return NextResponse.json(
        { error: '작성이 거부됐어요. 닉네임 등록 또는 작성 간격(10초)을 확인하세요.' },
        { status: 403 }
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
