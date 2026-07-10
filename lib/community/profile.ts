import 'server-only';

import { createClient } from '@/lib/supabase/server';

export interface Profile {
  id: string;
  nickname: string;
  verified_nickname: string | null;
  verified_ouid: string | null;
  verified_at: string | null;
}

/** 현재 로그인 사용자의 프로필(없으면 null). */
export async function getMyProfile(): Promise<{
  userId: string | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, profile: null };

  const { data } = await supabase
    .from('profiles')
    .select('id, nickname, verified_nickname, verified_ouid, verified_at')
    .eq('id', user.id)
    .maybeSingle();

  return { userId: user.id, profile: (data as Profile) ?? null };
}

/** 여러 작성자 id → 프로필 맵(닉네임/연동 구단주명 표시용). */
export async function getProfilesByIds(
  ids: string[]
): Promise<Map<string, Profile>> {
  const out = new Map<string, Profile>();
  const uniq = [...new Set(ids)].filter(Boolean);
  if (uniq.length === 0) return out;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, verified_nickname, verified_ouid, verified_at')
      .in('id', uniq);
    for (const p of (data as Profile[]) ?? []) out.set(p.id, p);
  } catch {
    // 프로필 조회 실패해도 게시글 자체는 표시(작성자명만 미상 처리)
  }
  return out;
}
