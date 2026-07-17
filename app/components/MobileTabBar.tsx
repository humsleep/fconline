"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 탭 4개: 검색(홈 히어로 포커스) · 스쿼드 · 커뮤니티 · 픽 랭킹
const TABS = [
  {
    href: "/?focus=1",
    label: "전적 검색",
    match: (p: string) => p === "/",
    icon: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.5-4.5" />
      </>
    ),
  },
  {
    href: "/squad",
    label: "스쿼드",
    match: (p: string) => p.startsWith("/squad"),
    icon: (
      <>
        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
        <path d="M9.5 12l1.8 1.8 3.2-3.6" />
      </>
    ),
  },
  {
    href: "/community",
    label: "커뮤니티",
    match: (p: string) => p.startsWith("/community"),
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M16 6.5a3 3 0 0 1 0 5.5M17.5 19a5.5 5.5 0 0 0-2.8-4.8" />
      </>
    ),
  },
  {
    href: "/meta",
    label: "픽 랭킹",
    match: (p: string) => p.startsWith("/meta"),
    icon: (
      <>
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </>
    ),
  },
  {
    // /me 는 로그인 없이도 기기 기반 재방문 훅(내 스쿼드·최근 검색·지난 방문)을 보여줌.
    // 기존엔 하단탭에 없어 모바일(특히 비로그인)에서 사실상 도달 불가 → 5번째 탭으로 노출.
    href: "/me",
    label: "내 정보",
    match: (p: string) => p === "/me", // "/meta" 와 충돌 방지 (startsWith 금지)
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </>
    ),
  },
] as const;

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/90 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="주요 메뉴"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[13px] font-semibold transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {t.icon}
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
