"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type State = "idle" | "busy" | "done" | "limited";

/** 전적 갱신 — 캐시 만료(POST) 후 페이지 새로고침. op.gg 시그니처 UX. */
export default function RefreshButton({ nickname }: { nickname: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [pending, startTransition] = useTransition();

  async function onClick() {
    if (state === "busy" || pending) return;
    setState("busy");
    try {
      const res = await fetch(`/api/refresh/${encodeURIComponent(nickname)}`, {
        method: "POST",
      });
      if (res.status === 429) {
        setState("limited");
        setTimeout(() => setState("idle"), 2500);
        return;
      }
      // 캐시 만료됨 → RSC 다시 요청해 최신 데이터 렌더
      startTransition(() => router.refresh());
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("idle");
    }
  }

  const label =
    state === "busy" || pending
      ? "갱신 중…"
      : state === "done"
        ? "갱신됨"
        : state === "limited"
          ? "잠시 후 다시"
          : "전적 갱신";

  return (
    <button
      onClick={onClick}
      disabled={state === "busy" || pending}
      aria-label="전적 갱신"
      className="scoreboard inline-flex min-h-11 flex-none items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] font-bold text-ink transition-colors hover:bg-line disabled:opacity-60"
    >
      <span aria-hidden className={state === "busy" || pending ? "animate-spin" : ""}>
        ↻
      </span>
      {label}
    </button>
  );
}
