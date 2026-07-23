import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPlayerNames, getSeasonNames } from "@/lib/nexon/players";
import { getPositionLabel } from "@/lib/nexon/meta";
import { loadPicks, type PickRow } from "@/lib/meta/picks";
import SeasonBadge from "@/app/components/SeasonBadge";
import PlayerSearch from "./PlayerSearch";

export const revalidate = 3600; // 스냅샷은 일 단위 — 1시간 캐시면 충분

export const metadata: Metadata = {
  title: "랭커 픽 랭킹",
  description:
    "상위 랭커가 실제로 가장 많이 쓴 선수 카드. 감이 아니라 데이터로 보는 메타.",
};

const LINE_ORDER = ["ATT", "MID", "DEF", "GK"] as const;
const LINE_TITLE: Record<(typeof LINE_ORDER)[number], string> = {
  ATT: "공격",
  MID: "미드필드",
  DEF: "수비",
  GK: "골키퍼",
};

interface TopMover {
  spId: number;
  position: number;
  /** >0 = 라인 내 순위 상승폭, null = 오늘 새로 진입(NEW) */
  delta: number | null;
  matchCount: number;
  line: string;
}

/**
 * "오늘의 급상승" 1건 선정 — loadPicks가 이미 채운 delta 재활용(추가 호출 0).
 * 상승폭 최대(동률 시 사용량 큰 카드) 우선, 없으면 NEW 진입 중 사용량 최대.
 * NEW를 동급 후보로 포함해야 변동이 작은 날에도 헤드라인이 비지 않는다.
 * 후보는 각 라인 상위 10위(=화면에 실제 노출되는 목록)로 제한 —
 * 11위+ 카드가 헤드라인에 뜨는데 아래 목록엔 없는 불일치 방지.
 */
function pickTopMover(byLine: Map<string, PickRow[]>): TopMover | null {
  let riser: (TopMover & { delta: number }) | null = null;
  let newcomer: TopMover | null = null;
  for (const [line, rows] of byLine) {
    for (const r of rows.slice(0, 10)) {
      if (typeof r.delta === "number" && r.delta > 0) {
        if (
          !riser ||
          r.delta > riser.delta ||
          (r.delta === riser.delta && r.matchCount > riser.matchCount)
        ) {
          riser = { spId: r.spId, position: r.position, delta: r.delta, matchCount: r.matchCount, line };
        }
      } else if (r.delta === null) {
        if (!newcomer || r.matchCount > newcomer.matchCount) {
          newcomer = { spId: r.spId, position: r.position, delta: null, matchCount: r.matchCount, line };
        }
      }
    }
  }
  return riser ?? newcomer;
}

export default async function MetaPage() {
  const { date, byLine } = await loadPicks();
  const allIds = [...byLine.values()].flat().map((r) => r.spId);
  const names = await getPlayerNames(allIds);
  const seasons = await getSeasonNames(allIds);

  const hasData = allIds.length > 0;
  const mover = pickTopMover(byLine);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-24 md:pb-16">
      <p className="scoreboard text-[13px] font-bold tracking-[0.25em] text-accent">
        RANKER PICKS
      </p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">랭커 픽 랭킹</h1>
      <p className="mt-1 text-sm text-muted">
        상위 랭커가 실제 경기에서 가장 많이 쓴 카드.
        {date && <span className="ml-1">({date} 스냅샷 기준)</span>}
      </p>

      {/* 선수 이름으로 도감 바로 검색 */}
      <PlayerSearch />

      {!hasData ? (
        <div className="panel mt-6 px-6 py-10 text-center text-sm text-muted">
          <p className="text-base font-semibold text-ink">
            오늘의 랭킹을 준비하고 있어요 ⚽
          </p>
          <p className="mt-2">
            먼저 내 전적부터 검색해 보세요 — 검색이 쌓일수록
            <br className="hidden sm:block" /> 랭커 픽 랭킹이 빨리 채워져요.
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
            const maxCount = rows[0]?.matchCount || 1;
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
                              평점 {r.rating.toFixed(2)}
                              {line === "ATT" && ` · 경기당 ⚽${r.goalsPerMatch}`}
                            </span>
                          </p>
                        </div>
                        <div className="w-20 flex-none text-right">
                          <p className="scoreboard text-lg font-bold text-ink">
                            {r.matchCount.toLocaleString()}
                          </p>
                          <p className="text-[12px] text-muted">랭커 경기</p>
                          {/* 라인 1위 대비 사용량 비례 바 */}
                          <div
                            className="ml-auto mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2"
                            aria-hidden
                          >
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.max(4, Math.round((r.matchCount / maxCount) * 100))}%` }}
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
