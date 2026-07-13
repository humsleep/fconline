/**
 * 팀컬러(시즌 구성) 표시 — 같은 시즌 카드 수 집계.
 * 넥슨 공식 API에 클럽/국가 팀컬러 데이터가 없어, 산출 가능한 시즌 팀컬러만 보여준다.
 * 빌더(실시간)와 저장 뷰(정적) 공용.
 */
export default function SeasonMix({
  seasons,
  compact = false,
}: {
  /** 배치된 카드들의 시즌명 목록 (빈 값은 '기타') */
  seasons: (string | undefined)[];
  compact?: boolean;
}) {
  const counts = new Map<string, number>();
  for (const s of seasons) {
    const key = s?.trim() || "기타";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (sorted.length === 0) return null;
  const best = sorted[0];

  return (
    <div className="mx-auto mt-2 max-w-md rounded-lg bg-surface-2/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="scoreboard text-[12px] font-bold tracking-[0.15em] text-muted">
          팀컬러 (시즌)
        </span>
        {sorted.map(([season, n]) => (
          <span
            key={season}
            className={`scoreboard rounded px-1.5 py-0.5 text-[12px] font-bold ${
              n >= 3 ? "bg-gold/20 text-gold" : "bg-surface text-muted"
            }`}
          >
            {season} ×{n}
          </span>
        ))}
      </div>
      {!compact && (
        <p className="mt-1 text-[12px] text-muted">
          {best[1] >= 3 ? (
            <>
              주력 시즌 팀컬러: <b className="text-gold">{best[0]} {best[1]}장</b> —
              같은 시즌을 모을수록 게임 내 팀컬러 보너스에 유리해요.
            </>
          ) : (
            <>같은 시즌 카드를 3장 이상 모으면 시즌 팀컬러 구성에 유리해요.</>
          )}
          <span className="ml-1 text-muted">
            (클럽·국가 팀컬러는 공식 API 미제공)
          </span>
        </p>
      )}
    </div>
  );
}
