import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPlayerNames, getSeasonNames } from "@/lib/nexon/players";
import { getPositionLabel } from "@/lib/nexon/meta";
import { loadPicks, pickTopMover, LINE_TITLE, type PickRow } from "@/lib/meta/picks";
import SeasonBadge from "@/app/components/SeasonBadge";
import PlayerSearch from "./PlayerSearch";

export const revalidate = 3600; // 스냅샷은 일 단위 — 1시간 캐시면 충분

export const metadata: Metadata = {
  title: "픽 랭킹",
  description:
    "최근 공식경기에서 선발로 가장 많이 쓰인 선수 카드와 넥슨 상위 랭커 성적. 감이 아니라 데이터로 보는 메타.",
  alternates: { canonical: "/meta" },
  openGraph: {
    type: "website", siteName: "FC Scope", locale: "ko_KR", url: "/meta",
    title: "픽 랭킹 · FC Scope",
    description: "최근 공식경기에서 선발로 가장 많이 쓰인 선수 카드와 넥슨 상위 랭커 성적.",
  },
};

const LINE_ORDER = ["ATT", "MID", "DEF", "GK"] as const;

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  // 공식경기(50)·감독모드(52) — 앱과 같은 전환. 그 밖의 값은 공식경기.
  const matchType = (await searchParams).type === "52" ? 52 : 50;
  const { date, byLine } = await loadPicks(matchType);
  const allIds = [...byLine.values()].flat().map((r) => r.spId);
  const names = await getPlayerNames(allIds);
  const seasons = await getSeasonNames(allIds);

  const hasData = allIds.length > 0;
  const mover = pickTopMover(byLine);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-24 md:pb-16">
      <p className="scoreboard text-[13px] font-bold tracking-[0.25em] text-accent">
        TOP PICKS
      </p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">픽 랭킹</h1>
      <p className="mt-1 text-sm text-muted">
        최근 {matchType === 52 ? "감독모드" : "공식경기"}에서 선발로 가장 많이 쓰인 카드와, 그 카드의 넥슨 상위 랭커 성적.
        {date && <span className="ml-1">({date} 스냅샷 기준)</span>}
      </p>
      <div className="mt-3 flex gap-2" role="tablist" aria-label="경기 종류">
        {([50, 52] as const).map((t) => (
          <Link
            key={t}
            href={t === 50 ? "/meta" : "/meta?type=52"}
            role="tab"
            aria-selected={matchType === t}
            className={`flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${
              matchType === t ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {t === 50 ? "공식경기" : "감독모드"}
          </Link>
        ))}
      </div>
      <Link
        href="/report/weekly"
        className="panel mt-3 flex min-h-11 items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:border-accent"
      >
        <span className="text-sm font-semibold text-ink">
          📊 메타 리포트 — 급상승·대세 카드 요약
        </span>
        <span className="scoreboard flex-none text-sm font-bold text-accent">보기 →</span>
      </Link>

      {/* 선수 이름으로 도감 바로 검색 */}
      <PlayerSearch />

      {!hasData ? (
        <div className="panel mt-6 px-6 py-10 text-center text-sm text-muted">
          <p className="text-base font-semibold text-ink">
            오늘의 랭킹을 준비하고 있어요 ⚽
          </p>
          <p className="mt-2">
            먼저 내 전적부터 검색해 보세요 — 검색이 쌓일수록
            <br className="hidden sm:block" /> 픽 랭킹이 빨리 채워져요.
          </p>
          <Link
            href="/?focus=1"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-ink"
          >
            내 전적 검색하기
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {/* 오늘의 급상승 — 매일 바뀌는 delta를 '사건'으로 헤드라인화 (재방문 훅) */}
          {mover && (
            <Link
              href={`/player/${mover.spId}`}
              className="panel flex items-center gap-3 border-win/40 px-4 py-3 transition-colors hover:border-accent"
            >
              <Image
                src={`/api/player-image/${mover.spId}`}
                alt=""
                width={44}
                height={44}
                unoptimized
                className="h-11 w-11 flex-none rounded-lg bg-surface-2 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="scoreboard text-[12px] font-bold tracking-[0.2em] text-win">
                  ⚡ 오늘의 급상승
                </p>
                <p className="mt-0.5 truncate text-sm font-bold">
                  {names.get(mover.spId) ?? `선수 ${mover.spId}`}
                  <span className="ml-1.5 text-[13px] font-medium text-muted">
                    {getPositionLabel(mover.position)} ·{" "}
                    {LINE_TITLE[mover.line as keyof typeof LINE_TITLE]}
                  </span>
                </p>
              </div>
              <span
                className={`scoreboard flex-none rounded-lg px-2.5 py-1.5 text-sm font-bold ${
                  mover.delta === null
                    ? "bg-gold/15 text-gold"
                    : "bg-win/15 text-win"
                }`}
              >
                {mover.delta === null ? "NEW 진입" : `▲${mover.delta}`}
              </span>
            </Link>
          )}
          {LINE_ORDER.map((line) => {
            const rows = (byLine.get(line) ?? []).slice(0, 10);
            if (rows.length === 0) return null;
            const countOf = (r: (typeof rows)[number]) => r.usage ?? r.matchCount;
            const maxCount = Math.max(1, ...rows.map(countOf));
            return (
              <section key={line}>
                <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
                  {LINE_TITLE[line]} TOP {rows.length}
                </h2>
                <ol className="mt-2 space-y-1.5">
                  {rows.map((r, i) => (
                    <li key={`${r.spId}:${r.position}`}>
                      <Link
                        href={`/player/${r.spId}`}
                        className="panel flex items-center gap-3 px-3 py-2.5 transition-colors hover:border-accent"
                      >
                        <span className="flex w-9 flex-none flex-col items-center">
                          <span
                            className={`scoreboard text-center text-sm font-bold ${
                              i === 0 ? "text-gold" : i < 3 ? "text-accent" : "text-muted"
                            }`}
                          >
                            {i + 1}
                          </span>
                          {/* 전일 대비 변동 — 매일 바뀌는 재미 */}
                          {r.delta === null ? (
                            <span className="scoreboard text-[11px] font-bold text-gold">NEW</span>
                          ) : r.delta && r.delta > 0 ? (
                            <span className="scoreboard text-[11px] font-bold text-win">▲{r.delta}</span>
                          ) : r.delta && r.delta < 0 ? (
                            <span className="scoreboard text-[11px] font-bold text-lose">▼{-r.delta}</span>
                          ) : null}
                        </span>
                        <Image
                          src={`/api/player-image/${r.spId}`}
                          alt=""
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10 flex-none rounded-lg bg-surface-2 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {names.get(r.spId) ?? `선수 ${r.spId}`}
                            <span className="ml-1.5 text-[13px] font-medium text-muted">
                              {getPositionLabel(r.position)}
                            </span>
                          </p>
                          <p className="scoreboard mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                            <SeasonBadge
                              spid={r.spId}
                              season={seasons.get(r.spId)}
                              size="xs"
                              className="flex-none"
                            />
                            <span>
                              {line === "ATT" || line === "MID"
                                ? `경기당 ⚽${r.goalsPerMatch}`
                                : `패스 ${r.passPct}%`}
                            </span>
                          </p>
                        </div>
                        <div className="w-20 flex-none text-right">
                          <p className="scoreboard text-lg font-bold text-ink">
                            {countOf(r).toLocaleString()}
                          </p>
                          <p className="text-[12px] text-muted">{r.usage != null ? "선발 횟수" : "랭커 경기"}</p>
                          {/* 라인 1위 대비 사용량 비례 바 */}
                          <div
                            className="ml-auto mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2"
                            aria-hidden
                          >
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.max(4, Math.round((countOf(r) / maxCount) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
          <p className="text-[13px] leading-relaxed text-muted">
            넥슨 랭커 스탯 매일 스냅샷 · 포지션별 집계
          </p>
        </div>
      )}
    </div>
  );
}
