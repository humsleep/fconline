import 'server-only';

import { createClient } from '@/lib/supabase/server';

export interface ClubPost {
  id: string;
  author_id: string;
  title: string;
  body: string;
  region: string | null;
  positions: string[];
  play_style: string | null;
  contact: string | null;
  status: string;
  created_at: string;
}

const COLUMNS =
  'id, author_id, title, body, region, positions, play_style, contact, status, created_at';

/** 짧은 공유 코드 (crypto.randomUUID 기반). */
export function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export async function listClubPosts(opts?: {
  region?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ posts: ClubPost[]; count: number }> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  try {
    const supabase = await createClient();
    let q = supabase
      .from('club_posts')
      .select(COLUMNS, { count: 'exact' })
      .order('status', { ascending: false }) // 'open' > 'closed' → 모집중이 먼저
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (opts?.region) q = q.eq('region', opts.region);
    const { data, count } = await q;
    return { posts: (data as ClubPost[]) ?? [], count: count ?? 0 };
  } catch {
    return { posts: [], count: 0 };
  }
}

export async function getClubPost(id: string): Promise<ClubPost | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('club_posts')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    return (data as ClubPost) ?? null;
  } catch {
    return null;
  }
}
