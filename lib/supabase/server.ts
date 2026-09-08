import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

/**
 * 서버 클라이언트 — 로그인 사용자 컨텍스트로 RLS 적용.
 * - 웹: 쿠키 세션(@supabase/ssr)
 * - iOS 네이티브 앱: `Authorization: Bearer <access_token>` (supabase-swift 세션).
 *   Bearer 가 있으면 PostgREST 요청에 그 토큰을 실어 RLS 가 사용자 컨텍스트로 동작하고,
 *   auth.getUser() 도 그 토큰으로 검증하도록 감싼다 → 기존 API 라우트 코드는 수정 없이 양쪽 지원.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  }

  let bearer: string | null = null;
  try {
    const auth = (await headers()).get('authorization');
    const m = auth?.match(/^Bearer\s+([A-Za-z0-9\-_.]+)$/i);
    if (m) bearer = m[1];
  } catch {
    // headers() 사용 불가 컨텍스트 — 쿠키 경로만
  }

  const supabase = createServerClient(url, key, {
    ...(bearer ? { global: { headers: { Authorization: `Bearer ${bearer}` } } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component에서 호출됨 — 세션 갱신은 미들웨어가 담당.
        }
      },
    },
  });

  if (bearer) {
    const token = bearer;
    const original = supabase.auth.getUser.bind(supabase.auth);
    supabase.auth.getUser = ((jwt?: string) => original(jwt ?? token)) as typeof supabase.auth.getUser;
  }

  return supabase;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
