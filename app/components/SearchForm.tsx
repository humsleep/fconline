"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const RECENT_KEY = "fcscope-recent-searches";
const RECENT_MAX = 5;

function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(nickname: string) {
  try {
    const next = [nickname, ...loadRecent().filter((r) => r !== nickname)].slice(
      0,
      RECENT_MAX
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage 불가 환경 무시
  }
}

export default function SearchForm({
  size = "lg",
  defaultValue = "",
}: {
  size?: "lg" | "sm";
  defaultValue?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const isLg = size === "lg";

  // 모바일 하단탭 "검색"(/?focus=1) 진입 시 자동 포커스 (히어로 입력만)
  useEffect(() => {
    if (!isLg) return;
    if (new URLSearchParams(window.location.search).get("focus") === "1") {
      inputRef.current?.focus();
    }
    setRecent(loadRecent()); // 최근 검색 칩 (hydration-safe: 마운트 후 로드)
  }, [isLg]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nickname = value.trim();
    // 빈 입력 무반응(첫 방문자가 가장 자주 겪는 막힘) → 포커스 + 인라인 안내
    if (!nickname) {
      setError(true);
      inputRef.current?.focus();
      return;
    }
    setError(false);
    rememberSearch(nickname);
    startTransition(() => {
      router.push(`/user/${encodeURIComponent(nickname)}`);
    });
  }

  function clearRecent() {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}
    setRecent([]);
  }

  return (
    <div className="w-full">
      <form onSubmit={submit} role="search" className="relative w-full">
        <input
          ref={inputRef}
          id={isLg ? "hero-search" : undefined}
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(false);
          }}
          placeholder="구단주명 검색"
          aria-label="구단주명 검색"
          aria-invalid={error || undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          className={`input-search ${
            isLg ? "h-14 pl-5 pr-24 text-base" : "h-9 pl-3 pr-16 text-sm"
          } ${error ? "ring-2 ring-lose" : ""}`}
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

      {error && (
        <p className="mt-2 text-center text-sm font-medium text-lose" role="alert">
          구단주명을 입력해 주세요
        </p>
      )}

      {/* 최근 검색 칩 — 한글 닉네임 반복 입력 마찰 제거 */}
      {isLg && recent.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-[13px] text-muted">최근</span>
          {recent.map((r) => (
            <Link
              key={r}
              href={`/user/${encodeURIComponent(r)}`}
              onClick={() => rememberSearch(r)}
              className="inline-flex min-h-9 max-w-[10rem] items-center truncate rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-accent hover:text-accent-ink"
            >
              {r}
            </Link>
          ))}
          <button
            onClick={clearRecent}
            className="inline-flex min-h-9 items-center px-1 text-[13px] text-muted underline underline-offset-2"
            aria-label="최근 검색 지우기"
          >
            지우기
          </button>
        </div>
      )}
    </div>
  );
}
