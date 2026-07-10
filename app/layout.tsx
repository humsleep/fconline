import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Sans_KR } from "next/font/google";
import Link from "next/link";
import SearchForm from "./components/SearchForm";
import MobileTabBar from "./components/MobileTabBar";
import ThemeToggle from "./components/ThemeToggle";
import AuthButton from "./components/AuthButton";
import "./globals.css";

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plex = IBM_Plex_Sans_KR({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "FC Scope — FC온라인 전적·스쿼드 진단 랩",
    template: "%s · FC Scope",
  },
  description:
    "FC온라인 전적 검색, AI 스쿼드 진단, 랭커 데이터 비교. 감이 아니라 데이터로.",
  appleWebApp: {
    capable: true,
    title: "FC Scope",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a1119",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${chakra.variable} ${plex.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="stadium-bg flex min-h-full flex-col">
        {/* 무플래시 테마 적용 (저장된 선호가 있으면 즉시 반영) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fcscope-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
            <Link
              href="/"
              className="scoreboard flex items-baseline gap-1.5 text-lg font-bold tracking-wide"
            >
              <span className="text-accent">FC</span>
              <span className="text-ink">SCOPE</span>
              <span className="mb-0.5 hidden rounded bg-surface-2 px-1.5 py-0.5 text-[13px] font-semibold text-muted sm:inline">
                BETA
              </span>
            </Link>
            <Link
              href="/community"
              className="ml-auto hidden text-sm font-semibold text-muted transition-colors hover:text-ink md:block"
            >
              커뮤니티
            </Link>
            <div className="hidden w-56 md:block">
              <SearchForm size="sm" />
            </div>
            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <AuthButton />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line/70 pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs leading-relaxed text-muted">
            <p>
              FC Scope은 비공식 팬 서비스입니다. Data based on NEXON Open API.
              게임 데이터의 저작권은 NEXON·EA에 있습니다.
            </p>
          </div>
        </footer>

        <MobileTabBar />
      </body>
    </html>
  );
}
