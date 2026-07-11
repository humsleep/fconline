import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p
        aria-hidden
        className="scoreboard text-5xl font-bold"
        style={{ color: "color-mix(in srgb, var(--ink) 12%, transparent)" }}
      >
        4:04
      </p>
      <h1 className="mt-4 text-xl font-bold">이 페이지는 경기장 밖이에요</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        주소가 바뀌었거나 삭제된 페이지일 수 있어요.
      </p>
      <Link
        href="/"
        className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
      >
        홈으로
      </Link>
    </div>
  );
}
