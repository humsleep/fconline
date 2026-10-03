import { handleLike } from '@/lib/community/like-route';

/** POST = 좋아요, DELETE = 취소. 로그인 필요, 멱등. 응답 `{ ok, liked, like_count }`. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleLike('post', (await params).id, true);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleLike('post', (await params).id, false);
}
