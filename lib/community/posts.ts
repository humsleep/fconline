import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { PostType } from './post-types';

export interface CommunityPost {
  id: string;
  author_id: string;
  type: PostType;
  title: string;
  body: string;
  region: string | null;
  positions: string[];
  contact: string | null;
  squad_id: string | null;
  meta: Record<string, string>;
  status: string;
  created_at: string;
}

const COLUMNS =
  'id, author_id, type, title, body, region, positions, contact, squad_id, meta, status, created_at';

export function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export async function listPosts(opts?: {
  type?: PostType | null;
  region?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ posts: CommunityPost[]; count: number }> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  try {
    const supabase = await createClient();
    let q = supabase
      .from('community_posts')
      .select(COLUMNS, { count: 'exact' })
      .order('status', { ascending: false }) // open이 먼저
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts?.type) q = q.eq('type', opts.type);
    if (opts?.region) q = q.eq('region', opts.region);
    const { data, count } = await q;
    return { posts: (data as CommunityPost[]) ?? [], count: count ?? 0 };
  } catch {
    return { posts: [], count: 0 };
  }
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  squad_id: string | null;
  created_at: string;
}

export async function listComments(postId: string): Promise<CommunityComment[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('community_comments')
      .select('id, post_id, author_id, body, squad_id, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(200);
    return (data as CommunityComment[]) ?? [];
  } catch {
    return [];
  }
}

export async function getPost(id: string): Promise<CommunityPost | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('community_posts')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    return (data as CommunityPost) ?? null;
  } catch {
    return null;
  }
}
