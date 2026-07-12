import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAdmin } from "@/lib/supabase/admin";
import { getPlayerNames, getSeasonNames } from "@/lib/nexon/players";
import { getPositionLabel } from "@/lib/nexon/meta";
import { baseLabelOfCode, posLineOf } from "@/lib/squad/assign";
import SeasonBadge from "@/app/components/SeasonBadge";
import type { RankerStat } from "@/lib/nexon/types";

export const revalidate = 3600; // 스냅샷은 일 단위 — 1시간 캐시면 충분

export const metadata: Metadata = {
  title: "랭커 픽 랭킹",
  description:
    "상위 랭커가 실제로 가장 많이 쓴 선수 카드. 감이 아니라 데이터로 보는 메타.",
};

interface PickRow {
  spId: number;
  position: number;
  matchCount: number;
  rating: number;
  goalsPerMatch: number;
  /** 전일 대비 순위 변동 (+상승/−하락), null=NEW, undefined=비교 불가 */
  delta?: number | null;
}

const LINE_ORDER = ["ATT", "MID", "DEF", "GK"] as const;
const LINE_TITLE: Record<(typeof LINE_ORDER)[number], string> = {
  ATT: "공격",
  MID: "미드필드",
  DEF: "수비",
  GK: "골키퍼",
};

async function loadPicks(): Promise<{
  date: string | null;
  byLine: Map<string, PickRow[]>;
}> {
  const empty = { date: null, byLine: new Map<string, PickRow[]>() };
  const db = getAdmin();
  if (!db) return empty;

  async function rowsForDate(cand: string): Promise<PickRow[]> {
    const db2 = getAdmin();
    if (!db2) return [];
    const { data } = await db2
      .from("ranker_stats_snapshot")
      .select("sp_id, sp_position, payload")
      .eq("match_type", 50)
      .eq("snapshot_date", cand)
      .is("payload->empty", null) // tombstone({empty:true}) 제외
      .order("sp_id", { ascending: true }) // 결정적 순서 (임의 누락 방지)
      .limit(400);
    const rows: PickRow[] = [];
    for (const r of data ?? []) {
      const payload = r.payload as RankerStat | null;
      const st = payload?.status ?? {};
      const matchCount = st.matchCount ?? 0;
      if (matchCount <= 0) continue;
      rows.push({
        spId: r.sp_id as number,
        position: r.sp_position as number,
        matchCount,
        rating: st.spRating ?? 0,
        goalsPerMatch: Math.round(((st.goal ?? 0) / matchCount) * 100) / 100,
      });
    }
    return rows;
  }

  function groupByLine(rows: PickRow[]): Map<string, PickRow[]> {
    const byLine = new Map<string, PickRow[]>();
    for (const row of rows) {
      const line = posLineOf(baseLabelOfCode(row.position));
      const arr = byLine.get(line) ?? [];
      arr.push(row);
      byLine.set(line, arr);
    }
    for (const arr of byLine.values())
      arr.sort((a, b) => b.matchCount - a.matchCount);
    return byLine;
  }

  try {
    // 최근 날짜 후보를 뽑아, 유효 데이터가 충분한 날을 채택 (자정 직후 편향/빈 랭킹 방지)
    const { data: dateRows } = await db
      .from("ranker_stats_snapshot")
      .select("snapshot_date")
      .eq("match_type", 50)
      .order("snapshot_date", { ascending: false })
      .limit(300);
    const candidates = [...new Set((dateRows ?? []).map((r) => r.snapshot_date as string))].slice(0, 4);
    if (candidates.length === 0) return empty;

    const MIN_ROWS = 20;
    let date: string | null = null;
    let best: PickRow[] = [];
    let chosenIdx = -1;

    for (let i = 0; i < Math.min(candidates.length, 3); i++) {
      const rows = await rowsForDate(candidates[i]);
      if (rows.length >= MIN_ROWS) {
        date = candidates[i];
        best = rows;
        chosenIdx = i;
        break;
      }
      if (rows.length > best.length) {
        date = candidates[i];
        best = rows;
        chosenIdx = i;
      }
    }

    const byLine = groupByLine(best);

    // 순위 변동(▲▼/NEW): 채택일 다음 후보(=직전 스냅샷)와 라인 내 순위 비교
    const prevDate = chosenIdx >= 0 ? candidates[chosenIdx + 1] : undefined;
    if (prevDate) {
      const prevRows = await rowsForDate(prevDate);
      if (prevRows.length > 0) {
        const prevRank = new Map<string, number>();
        for (const [, arr] of groupByLine(prevRows)) {
          arr.forEach((r, idx) =>
            prevRank.set(`${r.spId}:${r.position}`, idx + 1)
          );
        }
        for (const [, arr] of byLine) {
          arr.forEach((r, idx) => {
            const prev = prevRank.get(`${r.spId}:${r.position}`);
            r.delta = prev === undefined ? null : prev - (idx + 1);
          });
        }
      }
    }

    return { date, byLine };
  } catch {
    return empty;
  }
}

export default async function MetaPage() {
  const { date, byLine } = await loadPicks();
  const allIds = [...byLine.values()].flat().map((r) => r.spId);
  const names = await getPlayerNames(allIds);
  const seasons = await getSeasonNames(allIds);

  const hasData = allIds.length > 0;

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

      {!hasData ? (
        <div className="panel mt-6 px-6 py-16 text-center text-sm text-muted">
          <p className="text-base font-semibold text-ink">
            오늘의 랭킹을 준비하고 있어요 ⚽
          </p>
          <p className="mt-2">
            먼저 내 전적부터 검색해 보세요 — 검색이 쌓일수록
            <br className="hidden sm:block" /> 랭커 픽 랭킹이 빨리 채워져요.
          </p>
          <Link
            href="/?focus=1"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            내 전적 검색하기
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {LINE_ORDER.map((line) => {
            const rows = (byLine.get(line) ?? []).slice(0, 10);
            if (rows.length === 0) return null;
            return (
              <section key={line}>
                <h2 className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
                  {LINE_TITLE[line]} TOP {rows.length}
                </h2>
                <ol className="mt-2 space-y-1.5">
                  {rows.map((r, i) => (
                    <li key={`${r.spId}:${r.position}`}>
                      <div className="panel flex items-center gap-3 px-3 py-2.5">
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
                        <div className="flex-none text-right">
                          <p className="scoreboard text-lg font-bold text-ink">
                            {r.matchCount.toLocaleString()}
                          </p>
                          <p className="text-[12px] text-muted">랭커 경기</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
          <p className="text-[13px] leading-relaxed text-muted">
            집계 기준: 상위 랭커 실사용 데이터(넥슨 랭커 스탯)를 매일 스냅샷.
            같은 선수라도 포지션이 다르면 따로 집계됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
