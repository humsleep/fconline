import Image from "next/image";
import { getPositionLabel } from "@/lib/nexon/meta";
import {
  type SquadClinicResult,
  type ClinicPlayer,
  BAND_LABEL,
} from "@/lib/squad-clinic";

const BAND_COLOR: Record<SquadClinicResult["band"], string> = {
  top: "text-gold",
  strong: "text-accent",
  balanced: "text-ink",
  building: "text-muted",
  rebuild: "text-lose",
};

const SEV_DOT: Record<"high" | "mid" | "low", string> = {
  high: "bg-lose",
  mid: "bg-gold",
  low: "bg-muted",
};

/** 종합 점수에 맞춘 게이지 색 */
function scoreColor(score: number): string {
  if (score >= 80) return "var(--gold, #f2c14e)";
  if (score >= 50) return "var(--accent)";
  return "var(--lose, #fb7185)";
}

export default function SquadClinic({
  result,
  names,
  matches,
}: {
  result: SquadClinicResult;
  names: Map<number, string>;
  matches: number;
}) {
  const nameOf = (id: number) => names.get(id) ?? `선수 ${id}`;

  return (
    <section className="panel mt-4 overflow-hidden p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="scoreboard text-[12px] font-bold tracking-[0.2em] text-accent">
          SQUAD CLINIC
        </span>
        <span className="rounded bg-gold/15 px-2 py-0.5 text-[12px] font-bold text-gold">
          BETA
        </span>
      </div>

      {/* 종합 점수 + 라인별 바 */}
      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center">
        <ScoreDial result={result} />
        <div className="min-w-0 flex-1 space-y-2.5">
          {result.lines.map((l) => (
            <div key={l.line}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="font-semibold">
                  {l.label}
                  <span className="ml-1.5 text-muted">{l.count}명</span>
                </span>
                <span className="scoreboard font-semibold text-muted">
                  {l.avgRating.toFixed(2)}
                  {typeof l.gap === "number" && (
                    <span
                      className={
                        "ml-1.5 " + (l.gap >= 0 ? "text-win" : "text-lose")
                      }
                    >
                      {l.gap >= 0 ? "▲" : "▼"}
                      {Math.abs(l.gap).toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${l.score}%`,
                    backgroundColor: scoreColor(l.score),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 강점 / 약한 고리 */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ChipCard
          title="강점"
          tone="win"
          players={result.strengths}
          nameOf={nameOf}
          empty="두드러진 강점 표본 없음"
        />
        <ChipCard
          title="약한 고리"
          tone="lose"
          players={result.weakLinks}
          nameOf={nameOf}
          empty="약한 고리 없음 — 안정적"
        />
      </div>

      {/* 처방(이슈) */}
      {result.issues.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {result.issues.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]">
              <span
                aria-hidden
                className={
                  "mt-1.5 h-2 w-2 flex-none rounded-full " + SEV_DOT[it.severity]
                }
              />
              <span className="text-muted">
                {it.spId ? (
                  <span className="font-semibold text-ink">
                    {nameOf(it.spId)}{" "}
                  </span>
                ) : null}
                {it.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        최근 {matches}경기 · 주전 {result.players}명 · 룰베이스 진단(AI 미사용) ·
        랭커 커버리지 {Math.round(result.rankerCoverage * 100)}%
      </p>
    </section>
  );
}

function ScoreDial({ result }: { result: SquadClinicResult }) {
  const pct = result.overall;
  const color = scoreColor(pct);
  return (
    <div className="flex flex-none items-center gap-4">
      <div
        className="relative grid h-28 w-28 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${pct * 3.6}deg, var(--surface-2) 0deg)`,
        }}
      >
        <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-surface text-center">
          <div>
            <span className="scoreboard text-3xl font-bold" style={{ color }}>
              {pct}
            </span>
            <span className="block text-[11px] text-muted">/ 100</span>
          </div>
        </div>
      </div>
      <div className="sm:hidden">
        <p className={"text-lg font-bold " + BAND_COLOR[result.band]}>
          {BAND_LABEL[result.band]}
        </p>
        <p className="scoreboard text-[12px] text-muted">
          실사용 평점 {result.squadRating.toFixed(2)}
        </p>
      </div>
      <div className="hidden sm:block">
        <p className={"text-xl font-bold " + BAND_COLOR[result.band]}>
          {BAND_LABEL[result.band]}
        </p>
        <p className="scoreboard mt-0.5 text-[13px] text-muted">
          실사용 평점 {result.squadRating.toFixed(2)}
          {typeof result.avgGap === "number" && (
            <span
              className={
                "ml-2 " + (result.avgGap >= 0 ? "text-win" : "text-lose")
              }
            >
              랭커 대비 {result.avgGap >= 0 ? "+" : ""}
              {result.avgGap.toFixed(2)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function ChipCard({
  title,
  tone,
  players,
  nameOf,
  empty,
}: {
  title: string;
  tone: "win" | "lose";
  players: ClinicPlayer[];
  nameOf: (id: number) => string;
  empty: string;
}) {
  const toneText = tone === "win" ? "text-win" : "text-lose";
  return (
    <div className="panel p-3">
      <p className={"text-[12px] font-semibold " + toneText}>{title}</p>
      {players.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {players.map((p) => (
            <li key={p.spId} className="flex items-center gap-2">
              <Image
                src={`/api/player-image/${p.spId}`}
                alt=""
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7 flex-none rounded-md bg-surface-2 object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {nameOf(p.spId)}
                <span className="ml-1.5 font-normal text-muted">
                  {getPositionLabel(p.position)}
                </span>
              </span>
              <span className="scoreboard flex-none text-[13px] font-bold text-ink">
                {p.avgRating.toFixed(1)}
                {typeof p.gap === "number" && (
                  <span className={"ml-1 " + toneText}>
                    {p.gap >= 0 ? "+" : ""}
                    {p.gap.toFixed(1)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
