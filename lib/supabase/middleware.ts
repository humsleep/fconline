import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Supabase Auth 왕복이 매달리지 않도록 상한. 초과 시 세션 갱신만 건너뜀. */
const AUTH_TIMEOUT_MS = 3000;

/** p 가 ms 안에 안 끝나면 reject. 미들웨어가 인증 서버 지연에 볼모잡히는 것 방지. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('supabase auth timeout')), ms)
    ),
  ]);
}

/** 요청마다 Supabase 세션 갱신(쿠키 롤오버). 환경변수 없으면 통과. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // 세션 갱신은 best-effort. Supabase Auth 서버가 느리거나(무료 플랜 일시정지 등)
  // 불통이면 getUser() 가 미들웨어 타임아웃(504 MIDDLEWARE_INVOCATION_TIMEOUT)까지
  // 매달려 전 경로가 죽는다 — 비로그인 전적 검색·진단까지. timeout + catch 로
  // 인증 장애를 "로그아웃 상태"로 degrade 시켜 사이트는 계속 살린다.
  try {
    await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS);
  } catch {
    // 인증 서버 지연/불통 — 세션 갱신 건너뜀. 페이지는 정상 응답.
  }
  return supabaseResponse;
}
