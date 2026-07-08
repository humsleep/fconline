"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function SearchForm({
  size = "lg",
  defaultValue = "",
}: {
  size?: "lg" | "sm";
  defaultValue?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nickname = value.trim();
    if (!nickname) return;
    startTransition(() => {
      router.push(`/user/${encodeURIComponent(nickname)}`);
    });
  }

  const isLg = size === "lg";

  return (
    <form onSubmit={submit} role="search" className="relative w-full">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="구단주명 검색"
        aria-label="구단주명 검색"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        className={`input-search ${
          isLg ? "h-14 pl-5 pr-24 text-base" : "h-9 pl-3 pr-16 text-sm"
        }`}
      />
      <button
        type="submit"
        disabled={pending}
        className={`scoreboard absolute top-1/2 -translate-y-1/2 rounded-lg bg-accent font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 ${
          isLg ? "right-2 h-10 px-5 text-sm" : "right-1.5 h-6 px-3 text-xs"
        }`}
      >
        {pending ? "…" : "GO"}
      </button>
    </form>
  );
}
