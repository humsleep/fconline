import {
  risingStreak,
  isPeak,
  sparklinePoints,
  type FormPoint,
} from '@/lib/form-trend';

/**
 * 폼 추세 스파크라인 — "내가 나아지고 있나?"를 눈으로 보여주는 재방문 훅.
 * 승률(라임)·평점(골드) 두 선을 각자 스케일로 그리고, 연속 상승/최고 기록을 배지로 축하.
 * 표본이 3개 미만이면 렌더하지 않음(호출부에서 delta 문구로 대체).
 * 순수 SVG — 외부 차트 라이브러리 없음.
 */
export default function FormSparkline({ snapshots }: { snapshots: FormPoint[] }) {
  if (snapshots.length < 3) return null;

  const winRates = snapshots.map((s) => s.winRate);
  const ratings = snapshots.map((s) => s.avgRating);
  const streak = risingStreak(winRates);
  const peak = isPeak(winRates);

  return (
    <section className="panel mt-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
          📈 폼 추세
          <span className="ml-1.5 font-normal">최근 {snapshots.length}일</span>
        </p>
        {peak ? (
          <span className="scoreboard flex-none rounded-lg bg-gold/15 px-2.5 py-1 text-[13px] font-bold text-gold">
            🏆 폼 최고 기록!
          </span>
        ) : streak >= 2 ? (
          <span className="scoreboard flex-none rounded-lg bg-win/15 px-2.5 py-1 text-[13px] font-bold text-win">
            🔥 {streak}일 연속 상승
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <SparkCell
          label="승률"
          value={`${winRates[winRates.length - 1]}%`}
          points={sparklinePoints(winRates, 200, 40)}
          stroke="var(--accent)"
        />
        <SparkCell
          label="평균 평점"
          value={ratings[ratings.length - 1].toFixed(2)}
          points={sparklinePoints(ratings, 200, 40)}
          stroke="var(--gold)"
        />
      </div>

      <p className="mt-2 text-[12px] text-muted">
        방문할 때마다 하루 1개씩 기록돼요 · 오를수록 배지로 축하해드려요
      </p>
    </section>
  );
}

function SparkCell({
  label,
  value,
  points,
  stroke,
}: {
  label: string;
  value: string;
  points: string;
  stroke: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-muted">{label}</span>
        <span className="scoreboard text-sm font-bold text-ink">{value}</span>
      </div>
      <svg
        viewBox="0 0 200 40"
        className="mt-1.5 h-10 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} 추세`}
      >
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
