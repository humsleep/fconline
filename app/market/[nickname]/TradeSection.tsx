import { getUserTrades } from "@/lib/nexon/api";
import { NexonApiError } from "@/lib/nexon/client";
import { getPlayerNames, getSeasonNames } from "@/lib/nexon/players";
import { formatKoreanBP, formatKoreanBPShort } from "@/lib/format";
import { computeMarketStats, diagnoseMarket } from "@/lib/market/diagnosis";
import { TONE_BG, TONE_DOT, TONE_TEXT } from "@/lib/diagnosis/tone";
import TradeList, { type TradeRow } from "./TradeList";
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
  const net = totalSell - totalBuy;
  const days = buildDailyFlow(buy.rows, sell.rows);
  const diag = diagnoseMarket(computeMarketStats(buy.rows, sell.rows));

  const toRows = (rows: TradeRecord[]): TradeRow[] =>
    rows.map((t) => ({
      saleSn: String(t.saleSn),
      spid: t.spid,
      grade: t.grade || 1,
      value: t.value || 0,
      tradeDate: t.tradeDate,
      name: names.get(t.spid) ?? `선수 ${t.spid}`,
      season: seasons.get(t.spid) ?? "",
    }));

  return (
    <div className="mt-4 space-y-3">
      {/* 요약 */}
      <section className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
        <div>
          <p className="text-[13px] text-muted">최근 영입 지출</p>
          <p
            className="scoreboard text-xl font-bold text-lose"
            title={`-${totalBuy.toLocaleString()} BP`}
          >
            -{formatKoreanBP(totalBuy)}
            <span className="ml-1 text-sm font-normal text-muted">BP</span>
          </p>
        </div>
        <div>
          <p className="text-[13px] text-muted">최근 방출 수입</p>
          <p
            className="scoreboard text-xl font-bold text-win"
            title={`+${totalSell.toLocaleString()} BP`}
          >
            +{formatKoreanBP(totalSell)}
            <span className="ml-1 text-sm font-normal text-muted">BP</span>
          </p>
        </div>
        <div>
          <p className="text-[13px] text-muted">순수지</p>
          <p
            className={`scoreboard text-xl font-bold ${net >= 0 ? "text-win" : "text-lose"}`}
            title={`${net >= 0 ? "+" : "-"}${Math.abs(net).toLocaleString()} BP`}
          >
            {net >= 0 ? "+" : "-"}
            {formatKoreanBP(Math.abs(net))}
            <span className="ml-1 text-sm font-normal text-muted">BP</span>
          </p>
        </div>
      </section>

      {/* 이적 성향 진단 — 사전 셋팅 룰 100+개 중 매칭 결과 */}
      {diag.type && (
        <section className="panel p-4">
          <p className="scoreboard text-[13px] font-bold tracking-[0.15em] text-muted">
            이적 성향 진단
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={`scoreboard rounded-lg px-3 py-1.5 text-sm font-bold ${TONE_BG[diag.type.tone]} ${TONE_TEXT[diag.type.tone]}`}
            >
              {diag.type.title}
            </span>
            <p className="text-sm text-muted">{diag.type.desc}</p>
          </div>
          {diag.notes.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {diag.notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full ${TONE_DOT[n.tone]}`}
                    aria-hidden
                  />
                  <span>
                    <b className={TONE_TEXT[n.tone]}>{n.title}</b>
                    <span className="ml-1.5 text-muted">{n.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-muted">
            최근 영입 {buy.rows.length}건 · 방출 {sell.rows.length}건 기준 룰베이스 진단
          </p>
        </section>
      )}

      {/* 일별 거래 흐름 — 위(방출 수입)/아래(영입 지출) 미러 차트 */}
      {days.some((d) => d.buy > 0 || d.sell > 0) && <TradeFlowChart days={days} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <TradeList title="영입 (구매)" tone="lose" rows={toRows(buy.rows)} />
        <TradeList title="방출 (판매)" tone="win" rows={toRows(sell.rows)} />
      </div>

      <p className="text-[13px] leading-relaxed text-muted">
        넥슨 공식 이적시장 거래 기록 기준 · 최근 {LIMIT}건 · 가격은 거래 당시 BP
      </p>
    </div>
  );
}

interface DayFlow {
  label: string; // KST "M/D"
  buy: number;
  sell: number;
}

const FLOW_DAYS = 14;
const DAY_MS = 86_400_000;

/** 최근 거래일 기준 연속 14일(KST)로 영입/방출 금액을 일별 합산. 거래가 없으면 []. */
export function buildDailyFlow(buyRows: TradeRecord[], sellRows: TradeRecord[]): DayFlow[] {
  const toTime = (raw: string): number => {
    const iso = raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`;
    return new Date(iso).getTime();
  };
  const all = [
    ...buyRows.map((t) => ({ t: toTime(t.tradeDate), v: t.value || 0, kind: "buy" as const })),
    ...sellRows.map((t) => ({ t: toTime(t.tradeDate), v: t.value || 0, kind: "sell" as const })),
  ].filter((x) => !Number.isNaN(x.t));
  if (all.length === 0) return [];

  const kr = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  });
  const fmt = { format: (d: Date) => kr.format(d).replace(/\s/g, "").replace(/\.$/, "") };
  const latest = Math.max(...all.map((x) => x.t));

  const days: DayFlow[] = [];
  const byLabel = new Map<string, DayFlow>();
  for (let i = FLOW_DAYS - 1; i >= 0; i--) {
    const label = fmt.format(new Date(latest - i * DAY_MS));
    const d = { label, buy: 0, sell: 0 };
    days.push(d);
    byLabel.set(label, d);
  }
  for (const x of all) {
    const d = byLabel.get(fmt.format(new Date(x.t)));
    if (!d) continue; // 14일 이전 거래는 차트에서 제외 (목록에는 표시)
    if (x.kind === "buy") d.buy += x.v;
    else d.sell += x.v;
  }
  return days;
}

/** 데이터 끝만 둥근 세로 막대 path (기준선 쪽은 직각) */
function barPath(x: number, y: number, w: number, h: number, dir: "up" | "down"): string {
  const r = Math.min(3, h / 2, w / 2);
  if (h <= 0) return "";
  if (dir === "up") {
    // (x, y)~(x+w, y+h), 위쪽 모서리 둥글게
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  }
  // 아래쪽 모서리 둥글게
  return `M${x},${y} L${x + w},${y} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} Z`;
}

/** 위 = 방출 수입(win), 아래 = 영입 지출(lose). 위치+부호로 색 없이도 구분 가능. */
export function TradeFlowChart({ days }: { days: DayFlow[] }) {
  const W = 640;
  const H = 224;
  const PAD_X = 10;
  const MID = 100; // 기준선 y
  const MAX_BAR = 78;
  const LABEL_Y = H - 8;

  const max = Math.max(1, ...days.flatMap((d) => [d.buy, d.sell]));
  const scale = (v: number) => (v / max) * MAX_BAR;
  const slot = (W - PAD_X * 2) / days.length;
  const bw = Math.min(26, slot - 6);

  // 선택적 직접 라벨: 최대 수입일 / 최대 지출일에만
  const maxSellIdx = days.reduce((bi, d, i) => (d.sell > days[bi].sell ? i : bi), 0);
  const maxBuyIdx = days.reduce((bi, d, i) => (d.buy > days[bi].buy ? i : bi), 0);
  const labelEvery = days.length > 8 ? 2 : 1;

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="scoreboard text-[13px] font-bold tracking-[0.15em] text-muted">
          일별 거래 흐름
        </p>
        <span className="ml-auto flex items-center gap-3 text-[12px] text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-win" aria-hidden />
            방출 수입 (위)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-lose" aria-hidden />
            영입 지출 (아래)
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        role="img"
        aria-label="최근 14일 일별 영입 지출과 방출 수입"
      >
        {/* 기준선 */}
        <line x1={PAD_X} y1={MID} x2={W - PAD_X} y2={MID} stroke="var(--line)" strokeWidth="1" />

        {days.map((d, i) => {
          const cx = PAD_X + slot * i + slot / 2;
          const x = cx - bw / 2;
          const hs = scale(d.sell);
          const hb = scale(d.buy);
          return (
            <g key={d.label}>
              {d.sell > 0 && (
                <path d={barPath(x, MID - Math.max(hs, 2), bw, Math.max(hs, 2), "up")} fill="var(--win)" />
              )}
              {d.buy > 0 && (
                <path d={barPath(x, MID + 1, bw, Math.max(hb, 2), "down")} fill="var(--lose)" />
              )}
              {/* 직접 라벨 — 최대값에만 */}
              {i === maxSellIdx && d.sell > 0 && (
                <text x={cx} y={MID - Math.max(hs, 2) - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">
                  +{formatKoreanBPShort(d.sell)}
                </text>
              )}
              {i === maxBuyIdx && d.buy > 0 && (
                <text x={cx} y={MID + Math.max(hb, 2) + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">
                  -{formatKoreanBPShort(d.buy)}
                </text>
              )}
              {/* 날짜 라벨 */}
              {i % labelEvery === 0 && (
                <text x={cx} y={LABEL_Y} textAnchor="middle" fontSize="10" fill="var(--muted)">
                  {d.label}
                </text>
              )}
              {/* 호버 히트 영역 + 네이티브 툴팁 */}
              <rect x={PAD_X + slot * i} y={0} width={slot} height={H - 18} fill="transparent">
                <title>
                  {`${d.label} · 방출 +${d.sell > 0 ? formatKoreanBP(d.sell) : "0"} · 영입 -${d.buy > 0 ? formatKoreanBP(d.buy) : "0"}`}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[12px] text-muted">
        마지막 거래일 기준 최근 {FLOW_DAYS}일 · 그 이전 거래는 아래 목록에서
      </p>
    </section>
  );
}

