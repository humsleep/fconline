import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { loadPicks, topMovers, LINE_TITLE, type PickRow } from "@/lib/meta/picks";
import { getPlayerNames } from "@/lib/nexon/players";
import { getPositionLabel } from "@/lib/nexon/meta";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "FC온라인 랭커 메타 리포트 — 포지션별 대세 카드 & 급상승",
  description:
    "상위 랭커가 지금 가장 많이 쓰는 FC온라인 선수 카드와 이번 주 급상승·신규 진입 카드를 포지션별로. 감이 아니라 데이터로 보는 메타.",
  alternates: { canonical: "/report/weekly" },
  openGraph: {
    title: "FC온라인 랭커 메타 리포트",
    description: "포지션별 대세 카드 + 이번 주 급상승. 매일 갱신.",
    url: "/report/weekly",
  },
};

const LINE_ORDER = ["ATT", "MID", "DEF", "GK"] as const;

export default async function WeeklyReport() {
  const { date, byLine } = await loadPicks();
  const movers = topMovers(byLine, 6);
  const allIds = [
    ...movers.map((m) => m.spId),
    ...[...byLine.values()].flatMap((rows) => rows.slice(0, 5).map((r) => r.spId)),
  ];
  const names = await getPlayerNames(allIds);
  const hasData = byLine.size > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "FC온라인 랭커 메타 리포트",
    description: "상위 랭커의 포지션별 대세 카드와 이번 주 급상승 카드.",
    datePublished: date ?? undefined,
    author: { "@type": "Organization", name: "FC Scope" },
    mainEntityOfPage: `${SITE_URL}/report/weekly`,
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-24 md:pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="scoreboard text-[13px] font-bold tracking-[0.25em] text-accent">
        META REPORT
      </p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
        FC온라인 랭커 메타 리포트
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        상위 1만 랭커가 실제 공식경기에서 가장 많이 쓴 선수 카드를 포지션별로
        집계했습니다. 시세·오버롤이 아니라 <b className="text-ink">실사용 데이터</b>로
        보는 메타예요.
        {date && <span className="ml-1">({date} 스냅샷 기준 · 매일 갱신)</span>}
      </p>

      {!hasData ? (
        <div className="panel mt-6 px-6 py-10 text-center text-sm text-muted">
          <p className="text-base font-semibold text-ink">
            메타 데이터를 모으고 있어요 ⚽
          </p>
          <p className="mt-2">
            내 전적을 검색할수록 랭커 메타가 더 빨리 채워져요.
          </p>
          <Link
            href="/?focus=1"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-ink"
          >
            내 전적 검색하기
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* 이번 주 급상승 */}
          {movers.length > 0 && (
            <section>
              <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-win">
                ⚡ 이번 주 급상승 · 신규
              </h2>
              <ol className="mt-2 space-y-1.5">
                {movers.map((m) => (
                  <li key={`${m.spId}:${m.position}`}>
                    <Link
                      href={`/player/${m.spId}`}
                      className="panel flex items-center gap-3 px-3 py-2.5 transition-colors hover:border-accent"
                    >
                      <Image
                        src={`/api/player-image/${m.spId}`}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="h-9 w-9 flex-none rounded-lg bg-surface-2 object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {names.get(m.spId) ?? `선수 ${m.spId}`}
                        <span className="ml-1.5 text-[13px] font-medium text-muted">
                          {getPositionLabel(m.position)} · {LINE_TITLE[m.line] ?? m.line}
                        </span>
                      </span>
                      <span
                        className={`scoreboard flex-none rounded-lg px-2 py-1 text-[13px] font-bold ${
                          m.delta === null ? "bg-gold/15 text-gold" : "bg-win/15 text-win"
                        }`}
                      >
                        {m.delta === null ? "NEW" : `▲${m.delta}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 라인별 대세 카드 TOP5 */}
          {LINE_ORDER.map((line) => {
            const rows = (byLine.get(line) ?? []).slice(0, 5);
            if (rows.length === 0) return null;
            return (
              <section key={line}>
                <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
                  {LINE_TITLE[line]} 대세 카드 TOP {rows.length}
                </h2>
                <ol className="mt-2 space-y-1.5">
                  {rows.map((r: PickRow, i) => (
                    <li key={`${r.spId}:${r.position}`}>
                      <Link
                        href={`/player/${r.spId}`}
                        className="panel flex items-center gap-3 px-3 py-2.5 transition-colors hover:border-accent"
                      >
                        <span className="scoreboard w-5 flex-none text-center text-sm font-bold text-muted">
                          {i + 1}
                        </span>
                        <Image
                          src={`/api/player-image/${r.spId}`}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                          className="h-9 w-9 flex-none rounded-lg bg-surface-2 object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">
                          {names.get(r.spId) ?? `선수 ${r.spId}`}
                          <span className="ml-1.5 text-[13px] font-medium text-muted">
                            {getPositionLabel(r.position)}
                          </span>
                        </span>
                        <span className="scoreboard flex-none text-[13px] text-muted">
                          {line === "ATT" || line === "MID"
                            ? `⚽${r.goalsPerMatch}`
                            : `패스 ${r.passPct}%`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}

          <Link
            href="/meta"
            className="panel flex items-center justify-center px-4 py-3 text-sm font-bold text-accent transition-colors hover:border-accent"
          >
            포지션별 전체 랭킹 보기 →
          </Link>
          <p className="text-[13px] leading-relaxed text-muted">
            집계 기준: 넥슨 랭커 스탯(상위 1만 랭커 20경기 평균)을 매일 스냅샷.
            같은 선수라도 포지션이 다르면 따로 집계됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
