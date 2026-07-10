/**
 * tug-of-war 비교 바 — 내 값 vs 랭커 평균 (회의 아이디어 #5).
 * 내 값이 랭커를 넘으면 라임 발광, 밑돌면 muted. 랭커 평균은 눈금으로 표시.
 * 텍스트 갭 수치 대신 "누가 앞서는지"를 3초에 읽히게.
 */
export default function TugOfWar({
  label,
  mine,
  ranker,
  max,
  unit = "",
}: {
  label: string;
  mine: number;
  ranker: number;
  /** 바 스케일 최대값. 미지정 시 두 값의 1.25배 */
  max?: number;
  unit?: string;
}) {
  const scale = max ?? (Math.max(mine, ranker) * 1.25 || 1);
  const minePct = Math.min(100, Math.max(0, (mine / scale) * 100));
  const rankerPct = Math.min(100, Math.max(0, (ranker / scale) * 100));
  const ahead = mine >= ranker && mine > 0;

  return (
    <div
      role="img"
      aria-label={`${label}: 내 값 ${fmt(mine)}${unit}, 랭커 평균 ${fmt(ranker)}${unit} — ${
        ahead ? "앞섬" : "뒤처짐"
      }`}
    >
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="scoreboard font-semibold">
          {/* 색 + 형태(▲/▼) 이중 인코딩 */}
          <span className={ahead ? "text-accent" : "text-lose"} aria-hidden>
            {ahead ? "▲" : "▼"} {fmt(mine)}
            {unit}
          </span>
          <span className="mx-1 text-muted">
            / 랭커 {fmt(ranker)}
            {unit}
          </span>
        </span>
      </div>
      <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={ahead ? "h-full bg-accent" : "h-full bg-lose/70"}
          style={{
            width: `${minePct}%`,
            boxShadow: ahead ? "0 0 10px -2px var(--accent)" : undefined,
          }}
        />
        {/* 랭커 평균 눈금 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-ink/70"
          style={{ left: `${rankerPct}%` }}
        />
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
