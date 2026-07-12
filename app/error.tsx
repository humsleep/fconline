"use client";

import Link from "next/link";

// 예기치 못한 런타임 오류의 마지막 안전망 — 브랜드 톤 유지 + 즉시 재시도 제공
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p
        aria-hidden
        className="scoreboard text-5xl font-bold"
        style={{ color: "color-mix(in srgb, var(--ink) 12%, transparent)" }}
      >
        VAR
      </p>
      <h1 className="mt-4 text-xl font-bold">잠깐, 판독이 필요해요</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        일시적인 오류가 발생했어요. 다시 시도하면 대부분 해결됩니다.
      </p>
      <button
        onClick={reset}
        className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
      >
        다시 시도
      </button>
      <Link
        href="/"
        className="mt-4 text-sm text-muted underline underline-offset-2"
      >
        홈으로
      </Link>
    </div>
  );
}
