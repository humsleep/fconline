'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { safeNextPath } from '@/lib/security/safe-redirect';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = safeNextPath(searchParams.get('next'));
  const hasError = searchParams.get('error');
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (hasError === 'auth_failed')
      setError('로그인에 실패했습니다. 다시 시도해주세요.');
  }, [hasError]);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next);
    });
  }, [configured, next, router]);

  const signInWithGoogle = async () => {
    if (!configured) return;
    if (!agreed) {
      setError('이용약관과 개인정보처리방침에 동의해 주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 동의 시점 기록 (분쟁 대비 로컬 증적)
      try {
        localStorage.setItem(
          'fcscope-consent',
          JSON.stringify({ termsV: 1, privacyV: 1, at: new Date().toISOString() })
        );
      } catch {}
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-md items-center px-4 py-12">
      <div className="panel w-full p-8 text-center">
        <div className="scoreboard flex items-baseline justify-center gap-1.5 text-2xl font-bold">
          <span className="text-accent">FC</span>
          <span className="text-ink">SCOPE</span>
        </div>
        <h1 className="mt-6 text-xl font-bold">로그인</h1>
        <p className="mt-2 text-sm text-muted">
          클럽 모집·커뮤니티 참여에는 로그인이 필요합니다. 전적 검색·진단은
          로그인 없이도 이용할 수 있어요.
        </p>

        {!configured ? (
          <div className="mt-6 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
            <p>
              로그인 준비 중이에요. 전적 검색·진단·스쿼드 빌더는 로그인 없이
              바로 쓸 수 있어요.
              {process.env.NODE_ENV !== 'production' &&
                ' (Supabase 환경변수 미설정)'}
            </p>
          </div>
        ) : (
          <>
          <label className="mt-6 flex cursor-pointer items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-left text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-muted">
              <Link href="/terms" target="_blank" className="text-accent underline underline-offset-2">
                이용약관
              </Link>
              과{' '}
              <Link href="/privacy" target="_blank" className="text-accent underline underline-offset-2">
                개인정보처리방침
              </Link>
              에 동의하며, 만 14세 이상입니다.
            </span>
          </label>
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold transition hover:bg-surface-2 disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
              />
            </svg>
            {loading ? '이동 중…' : 'Google로 계속하기'}
          </button>
          </>
        )}

        {error && <p className="mt-4 text-sm text-lose">{error}</p>}

        <p className="mt-6 text-[13px] leading-relaxed text-muted">
          로그인 시 서비스 이용에 필요한 최소 정보(이메일·프로필)만 사용합니다.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-muted underline underline-offset-2"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-muted">불러오는 중…</div>}>
      <LoginContent />
    </Suspense>
  );
}
