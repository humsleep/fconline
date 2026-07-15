"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SeasonBadge from "@/app/components/SeasonBadge";
import { formatKoreanBPShort, formatRelativeKr } from "@/lib/format";

export interface TradeRow {
  saleSn: string;
  spid: number;
  grade: number;
  value: number;
  tradeDate: string;
  name: string;
  season: string;
}

type SortKey = "recent" | "priceDesc" | "priceAsc" | "gradeDesc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "최신순" },
  { key: "priceDesc", label: "높은 금액순" },
  { key: "priceAsc", label: "낮은 금액순" },
  { key: "gradeDesc", label: "강화 높은순" },
];

function sortRows(rows: TradeRow[], key: SortKey): TradeRow[] {
  const arr = [...rows];
  switch (key) {
    case "priceDesc":
      return arr.sort((a, b) => b.value - a.value);
    case "priceAsc":
      return arr.sort((a, b) => a.value - b.value);
    case "gradeDesc":
      return arr.sort((a, b) => b.grade - a.grade || b.value - a.value);
    default:
      return arr.sort(
        (a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime()
      );
  }
}

/** 영입/방출 목록 — 정렬 셀렉트 포함 (모바일에서 금액순 비교용) */
export default function TradeList({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "win" | "lose";
  rows: TradeRow[];
}) {
  const [sort, setSort] = useState<SortKey>("recent");
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  return (
    <section className="panel p-4">
      <div className="flex items-center gap-2">
        <p
          className={`scoreboard text-[13px] font-bold tracking-[0.15em] ${
            tone === "win" ? "text-win" : "text-lose"
          }`}
        >
          {title} · {rows.length}
        </p>
        {rows.length > 1 && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input-search ml-auto h-11 flex-none px-2 text-[13px]"
            aria-label={`${title} 정렬`}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-muted">최근 기록이 없어요.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {sorted.slice(0, 20).map((t) => (
            <li key={t.saleSn}>
              <Link
                href={`/player/${t.spid}`}
                className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-2.5 py-2 transition-colors hover:bg-line"
              >
                <img
                  src={`/api/player-image/${t.spid}`}
                  alt=""
                  width={34}
                  height={34}
                  loading="lazy"
                  className="h-[34px] w-[34px] flex-none rounded-md bg-surface object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    <span className="truncate">{t.name}</span>
                    <SeasonBadge
                      spid={t.spid}
                      season={t.season}
                      size="xs"
                      className="flex-none"
                    />
                    {t.grade > 1 && (
                      <span className="scoreboard flex-none text-[12px] font-bold text-gold">
                        +{t.grade}
                      </span>
                    )}
                  </p>
                  <p className="scoreboard text-[12px] text-muted">
                    {formatRelativeKr(t.tradeDate)}
                  </p>
                </div>
                <span
                  className={`scoreboard flex-none text-sm font-bold ${
                    tone === "win" ? "text-win" : "text-lose"
                  }`}
                  title={`${tone === "win" ? "+" : "-"}${t.value.toLocaleString()} BP`}
                >
                  {tone === "win" ? "+" : "-"}
                  {formatKoreanBPShort(t.value)}
                </span>
              </Link>
            </li>
          ))}
          {sorted.length > 20 && (
            <li className="pt-1 text-center text-[12px] text-muted">
              상위 20건 표시 · 전체 {sorted.length}건
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
