import 'server-only';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/security/rate-limit';
import { isMissingSchema } from './v2';

/**
 * 좋아요 토글 공용 핸들러 — POST(누르기)/DELETE(취소), 둘 다 멱등.
 * 응답: `{ ok: true, liked: boolean, like_count: number | null }`
 *   like_count 는 트리거가 반영한 뒤의 값(읽기 실패 시 null).
 * 0023 미적용이면 503 `{ error, code: 'not_ready' }` — 앱은 하트를 원래대로 되돌린다.
 */
export async function handleLike(kind: 'post' | 'comment', id: string, like: boolean) {
  if (!/^[a-zA-Z0-9]{1,32}$/.test(id))
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // 연타 방지 — 사용자당 분당 60회(인스턴스 메모리 기준, 정확한 방어는 PK 가 한다)
  const rl = rateLimit(`like:${user.id}`, 60, 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: '잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );

  const table = kind === 'post' ? 'post_likes' : 'comment_likes';
  const col = kind === 'post' ? 'post_id' : 'comment_id';
  const target = kind === 'post' ? 'community_posts' : 'community_comments';

  const { error } = like
    ? await supabase
        .from(table)
        .upsert({ [col]: id, user_id: user.id }, { onConflict: `${col},user_id`, ignoreDuplicates: true })
    : await supabase.from(table).delete().eq(col, id).eq('user_id', user.id);

  if (error) {
    if (isMissingSchema(error))
      return NextResponse.json({ error: '아직 준비 중인 기능이에요.', code: 'not_ready' }, { status: 503 });
    if (error.code === '23503')
      return NextResponse.json({ error: kind === 'post' ? '삭제된 글입니다.' : '삭제된 댓글입니다.' }, { status: 404 });
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 });
  }

  const { data } = await supabase.from(target).select('like_count').eq('id', id).maybeSingle();
  const n = (data as { like_count?: number } | null)?.like_count;
  return NextResponse.json({ ok: true, liked: like, like_count: typeof n === 'number' ? n : null });
}
