"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 홈은 상단 로고로 충분 — 탭은 목적지 4개만
const TABS = [
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
    href: "/me",
    label: "내 정보",
    match: (p: string) => p === "/me",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.2" />
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
