"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "홈",
    match: (p: string) => p === "/",
    icon: (
      <path d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-5h4v5h5V9.5" />
    ),
  },
  {
    href: "/vs",
    label: "오늘의 VS",
    match: (p: string) => p.startsWith("/vs"),
    icon: (
      <>
        <path d="M4 5l6 14M20 5l-6 14" />
        <path d="M10.5 12h3" />
      </>
    ),
  },
  {
    href: "/?focus=1",
    label: "검색",
    match: (p: string) => p.startsWith("/user") || p.startsWith("/live"),
    icon: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-3.5-3.5" />
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
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[12px] font-semibold transition-colors ${
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
