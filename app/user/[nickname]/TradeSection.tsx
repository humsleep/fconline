import Image from "next/image";
import Link from "next/link";
import { getUserTrades } from "@/lib/nexon/api";
import { NexonApiError } from "@/lib/nexon/client";
import { getPlayerNames, getSeasonNames } from "@/lib/nexon/players";
import { formatRelativeKr } from "@/lib/format";
import SeasonBadge from "@/app/components/SeasonBadge";
import type { TradeRecord } from "@/lib/nexon/types";

const LIMIT = 40;

async function loadTrades(
  ouid: string,
  type: "buy" | "sell"
): Promise<{ ok: boolean; rows: TradeRecord[] }> {
  try {
    const rows = await getUserTrades(ouid, type, LIMIT);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch (err) {
    // 엔드포인트 미지원/장애도 페이지를 깨지 않도록 graceful
    if (err instanceof NexonApiError) return { ok: false, rows: [] };
    return { ok: false, rows: [] };
  }
}

/** 이적시장 거래 내역 — 영입(buy)/방출(sell)을 넥슨 공식 데이터로. */
export default async function TradeSection({ ouid }: { ouid: string }) {
  const [buy, sell] = await Promise.all([
    loadTrades(ouid, "buy"),
    loadTrades(ouid, "sell"),
  ]);

  const allSpids = [...buy.rows, ...sell.rows].map((t) => t.spid);
  const names = await getPlayerNames(allSpids);
  const seasons = await getSeasonNames(allSpids);

  // 두 조회 모두 실패(엔드포인트 미지원 등)면 안내
  if (!buy.ok && !sell.ok) {
    return (
      <div className="panel mt-4 px-6 py-14 text-center text-sm text-muted">
        거래 내역을 불러올 수 없어요. 넥슨 API가 일시적으로 원활하지 않거나
        이 구단주의 거래 기록이 비공개일 수 있어요.
      </div>
    );
  }

  const totalBuy = buy.rows.reduce((a, t) => a + (t.value || 0), 0);
  const totalSell = sell.rows.reduce((a, t) => a + (t.value || 0), 0);

  return (
    <div className="mt-4 space-y-3">
      {/* 요약 */}
      <section className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <div>
          <p className="text-[13px] text-muted">최근 영입 지출</p>
          <p className="scoreboard text-xl font-bold text-lose">
            -{totalBuy.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted">BP</span>
          </p>
        </div>
        <div>
          <p className="text-[13px] text-muted">최근 방출 수입</p>
          <p className="scoreboard text-xl font-bold text-win">
            +{totalSell.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted">BP</span>
          </p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <TradeList
          title="영입 (구매)"
          tone="lose"
          rows={buy.rows}
          names={names}
          seasons={seasons}
        />
        <TradeList
          title="방출 (판매)"
          tone="win"
          rows={sell.rows}
          names={names}
          seasons={seasons}
        />
      </div>

      <p className="text-[13px] leading-relaxed text-muted">
        넥슨 공식 이적시장 거래 기록 기준 · 최근 {LIMIT}건 · 가격은 거래 당시 BP
      </p>
    </div>
  );
}

function TradeList({
  title,
  tone,
  rows,
  names,
  seasons,
}: {
  title: string;
  tone: "win" | "lose";
  rows: TradeRecord[];
  names: Map<number, string>;
  seasons: Map<number, string>;
}) {
  return (
    <section className="panel p-4">
      <p className={`scoreboard text-[13px] font-bold tracking-[0.15em] ${tone === "win" ? "text-win" : "text-lose"}`}>
        {title} · {rows.length}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">최근 기록이 없어요.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.slice(0, 20).map((t) => (
            <li key={t.saleSn}>
              <Link
                href={`/player/${t.spid}`}
                className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-2.5 py-2 transition-colors hover:bg-line"
              >
                <Image
                  src={`/api/player-image/${t.spid}`}
                  alt=""
                  width={34}
                  height={34}
                  unoptimized
                  className="h-[34px] w-[34px] flex-none rounded-md bg-surface object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    <span className="truncate">{names.get(t.spid) ?? `선수 ${t.spid}`}</span>
                    <SeasonBadge spid={t.spid} season={seasons.get(t.spid)} size="xs" className="flex-none" />
                    {t.grade > 1 && (
                      <span className="scoreboard flex-none text-[12px] font-bold text-gold">+{t.grade}</span>
                    )}
                  </p>
                  <p className="scoreboard text-[12px] text-muted">
                    {formatRelativeKr(t.tradeDate)}
                  </p>
                </div>
                <span className={`scoreboard flex-none text-sm font-bold ${tone === "win" ? "text-win" : "text-lose"}`}>
                  {tone === "win" ? "+" : "-"}
                  {(t.value || 0).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
