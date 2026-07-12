import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * 내 글에 달린 새 댓글 알림 — since(ISO) 이후, 내가 쓴 댓글 제외.
 * 마지막 확인 시각은 클라이언트(localStorage)가 관리한다.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ total: 0, items: [] });

  const sinceRaw = new URL(request.url).searchParams.get('since');
  const since =
    sinceRaw && !Number.isNaN(Date.parse(sinceRaw))
      ? new Date(sinceRaw).toISOString()
      : new Date(0).toISOString();

  try {
    // 내 최근 글
    const { data: myPosts } = await supabase
      .from('community_posts')
      .select('id, title')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const posts = myPosts ?? [];
    if (posts.length === 0) return NextResponse.json({ total: 0, items: [] });

    const titleById = new Map(posts.map((p) => [p.id as string, p.title as string]));
    const { data: comments } = await supabase
      .from('community_comments')
      .select('post_id, author_id, created_at')
      .in('post_id', posts.map((p) => p.id))
      .gt('created_at', since)
      .neq('author_id', user.id)
      .limit(200);

    const countByPost = new Map<string, number>();
    for (const c of comments ?? []) {
      const pid = c.post_id as string;
      countByPost.set(pid, (countByPost.get(pid) ?? 0) + 1);
    }

    const items = [...countByPost.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([postId, count]) => ({
        postId,
        title: titleById.get(postId) ?? '내 글',
        count,
      }));
    const total = [...countByPost.values()].reduce((s, n) => s + n, 0);

    return NextResponse.json({ total, items });
  } catch {
    return NextResponse.json({ total: 0, items: [] });
  }
}
