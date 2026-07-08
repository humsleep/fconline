import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Sans_KR } from "next/font/google";
import Link from "next/link";
import SearchForm from "./components/SearchForm";
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
    default: "FC Lab — FC온라인 전적·스쿼드 진단 랩",
    template: "%s · FC Lab",
  },
  description:
    "FC온라인 전적 검색, AI 스쿼드 진단, 랭커 데이터 비교. 감이 아니라 데이터로.",
};

export const viewport: Viewport = {
  themeColor: "#0a1119",
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
    >
      <body className="stadium-bg flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
            <Link
              href="/"
              className="scoreboard flex items-baseline gap-1.5 text-lg font-bold tracking-wide"
            >
              <span className="text-accent">FC</span>
              <span className="text-ink">LAB</span>
              <span className="mb-0.5 hidden rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:inline">
                BETA
              </span>
            </Link>
            <div className="ml-auto hidden w-72 md:block">
              <SearchForm size="sm" />
            </div>
            <Link
              href="/"
              className="ml-auto text-sm text-muted transition-colors hover:text-accent md:hidden"
            >
              검색
            </Link>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line/70">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs leading-relaxed text-muted">
            <p>
              FC Lab은 비공식 팬 서비스입니다. Data based on NEXON Open API.
              게임 데이터의 저작권은 NEXON·EA에 있습니다.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
