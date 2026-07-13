import { getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { NexonApiError } from "@/lib/nexon/client";
import {
  aggregateReport,
  reportInsights,
  type Insight,
  type MatchReport,
  type ShotTypeStat,
  type TimeBand,
} from "@/lib/nexon/report";

const MATCH_COUNT = 30;

const TONE_DOT: Record<Insight["tone"], string> = {
  good: "text-win",
  warn: "text-lose",
  info: "text-gold",
};
const TONE_ICON: Record<Insight["tone"], string> = {
  good: "▲",
  warn: "▼",
  info: "◆",
};

export default async function ReportSection({
  ouid,
  matchType,
}: {
  ouid: string;
  matchType: number;
}) {
  let matchIds: string[] = [];
  let listOk = true;
  try {
    matchIds = await getUserMatches(ouid, matchType, MATCH_COUNT);
  } catch (err) {
    if (!(err instanceof NexonApiError)) throw err;
    listOk = false;
  }
  const details = await getMatchDetailsBatch(matchIds);
  const report = aggregateReport(details, ouid);

  if (report.played === 0) {
    return (
      <div className="panel mt-4 px-6 py-14 text-center text-sm text-muted">
        {listOk
          ? "분석할 경기 기록이 없어요."
          : "넥슨 조회가 일시적으로 원활하지 않아 경기를 불러오지 못했어요. 잠시 후 새로고침해 주세요."}
      </div>
    );
  }

  const insights = reportInsights(report);
  const diff = report.goalsFor - report.goalsAgainst;

  return (
    <div className="mt-4 space-y-3">
      {/* 종합 요약 스트립 */}
      <section className="panel p-5">
        <p className="scoreboard text-[13px] font-bold tracking-[0.2em] text-accent">
          ANALYSIS REPORT
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="text-[13px] text-muted">최근 {report.played}경기 득실</p>
            <p className="scoreboard text-2xl font-bold">
              <span className="text-accent">{report.goalsFor}</span>
              <span className="mx-1 text-muted">:</span>
              <span className="text-lose">{report.goalsAgainst}</span>
              <span
                className={`ml-2 text-lg ${
                  diff > 0 ? "text-win" : diff < 0 ? "text-lose" : "text-muted"
                }`}
              >
                {diff > 0 ? `+${diff}` : diff}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[13px] text-muted">경기당 평점</p>
            <p className="scoreboard text-2xl font-bold text-gold">
              {report.avgRating.toFixed(2)}
            </p>
          </div>
        </div>
      </section>

      {/* 자동 인사이트 (처방) */}
      {insights.length > 0 && (
        <section className="panel p-5">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            자동 코칭
          </p>
          <ul className="mt-3 space-y-2.5">
            {insights.map((ins, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span className={`flex-none font-bold ${TONE_DOT[ins.tone]}`}>
                  {TONE_ICON[ins.tone]}
                </span>
                <span>{ins.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 시간대별 득실 (버터플라이) */}
      <section className="panel p-5">
        <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
          시간대별 득실
        </p>
        <div className="mt-2 flex items-center justify-between text-[13px] font-semibold">
          <span className="text-accent">득점</span>
          <span className="text-muted">시간(분)</span>
          <span className="text-lose">실점</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {report.timeBands.map((b) => (
            <TimeBandRow key={b.label} band={b} max={maxBand(report.timeBands)} />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          득점 시각 기준(추정) · 추가시간·연장은 인접 구간에 포함돼요.
        </p>
      </section>

      {/* 슛 타입 결정력 (시도/성공 2색) */}
      {report.shotTypes.length > 0 && (
        <section className="panel p-5">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            슛 타입 결정력
          </p>
          <div className="mt-3 space-y-3">
            {report.shotTypes.map((s) => (
              <ShotTypeRow key={s.key} stat={s} max={maxShot(report.shotTypes)} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> 성공(골)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-surface-2 ring-1 ring-line" /> 시도
            </span>
          </div>
        </section>
      )}

      {/* 폼 타임라인 (경기별 득실차 + 스트릭) */}
      {report.form.length > 0 && (
        <section className="panel p-5">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            폼 타임라인 (오래된 → 최근)
          </p>
          <div className="mt-3">
            <FormChart form={report.form} />
          </div>
          <p className="mt-2 text-[12px] text-muted">
            위=승세(득점 우위) · 아래=실점 우위 · 막대 색은 승(라임)/무(회)/패(로즈)
          </p>
        </section>
      )}

      <p className="text-[13px] leading-relaxed text-muted">
        최근 {report.played}경기 기준 · 이미 불러온 경기 데이터로 계산(추가 조회 없음) ·
        룰베이스 분석(AI 미사용)
      </p>
    </div>
  );
}

function maxBand(bands: TimeBand[]): number {
  return Math.max(1, ...bands.map((b) => Math.max(b.forGoals, b.againstGoals)));
}
function maxShot(shots: ShotTypeStat[]): number {
  return Math.max(1, ...shots.map((s) => s.tries));
}

function TimeBandRow({ band, max }: { band: TimeBand; max: number }) {
  const forPct = (band.forGoals / max) * 100;
  const againstPct = (band.againstGoals / max) * 100;
  return (
    <div className="flex items-center gap-2">
      {/* 좌: 득점 (오른쪽 정렬로 중앙 기준 뻗음) */}
      <div className="flex flex-1 items-center justify-end gap-1.5">
        {band.forGoals > 0 && (
          <span className="scoreboard text-[12px] font-bold text-accent">
            {band.forGoals}
          </span>
        )}
        <div className="h-2.5 w-full max-w-[42vw] overflow-hidden rounded-l-full bg-surface-2">
          <span
            className="ml-auto block h-full rounded-l-full bg-accent"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>
      <span className="scoreboard w-14 flex-none text-center text-[12px] font-semibold text-muted">
        {band.label}
      </span>
      {/* 우: 실점 */}
      <div className="flex flex-1 items-center gap-1.5">
        <div className="h-2.5 w-full max-w-[42vw] overflow-hidden rounded-r-full bg-surface-2">
          <span
            className="block h-full rounded-r-full bg-lose"
            style={{ width: `${againstPct}%` }}
          />
        </div>
        {band.againstGoals > 0 && (
          <span className="scoreboard text-[12px] font-bold text-lose">
            {band.againstGoals}
          </span>
        )}
      </div>
    </div>
  );
}

function ShotTypeRow({ stat, max }: { stat: ShotTypeStat; max: number }) {
  const conv = stat.tries > 0 ? Math.round((stat.goals / stat.tries) * 100) : 0;
  const triesPct = (stat.tries / max) * 100;
  const goalsPct = stat.tries > 0 ? (stat.goals / stat.tries) * triesPct : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-semibold">{stat.label}</span>
        <span className="scoreboard text-muted">
          <span className="font-bold text-accent">{stat.goals}</span> / {stat.tries}골
          <span className="ml-1.5 text-ink">{conv}%</span>
        </span>
      </div>
      {/* 시도 트랙 위에 성공 세그먼트 겹치기 */}
      <div className="relative mt-1.5 h-2.5 w-full rounded-full bg-surface-2">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-surface-2 ring-1 ring-inset ring-line"
          style={{ width: `${triesPct}%` }}
        />
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{ width: `${goalsPct}%` }}
        />
      </div>
    </div>
  );
}

/** 경기별 득실차 컬럼 (SVG, viewBox 스케일 → 가로 스크롤 없음). 최근 24경기 상한. */
function FormChart({ form }: { form: { diff: number; result: string; label: string }[] }) {
  const games = form.slice(0, 24).reverse(); // 오래된 → 최근
  const n = games.length;
  const W = 100;
  const H = 44;
  const mid = H / 2;
  const maxAbs = Math.max(3, ...games.map((g) => Math.abs(g.diff)));
  const slot = W / n;
  const barW = Math.min(slot * 0.6, 3.2);

  const color = (r: string) =>
    r === "승" ? "var(--win)" : r === "패" ? "var(--lose)" : "var(--muted)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="경기별 득실차">
      <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--line)" strokeWidth="0.3" />
      {games.map((g, i) => {
        const cx = slot * (i + 0.5);
        const h = (Math.abs(g.diff) / maxAbs) * (mid - 2);
        const y = g.diff >= 0 ? mid - h : mid;
        return (
          <g key={i}>
            <title>{g.label}</title>
            <rect
              x={cx - barW / 2}
              y={g.diff === 0 ? mid - 0.6 : y}
              width={barW}
              height={g.diff === 0 ? 1.2 : h}
              rx="0.6"
              fill={color(g.result)}
            />
          </g>
        );
      })}
    </svg>
  );
}
