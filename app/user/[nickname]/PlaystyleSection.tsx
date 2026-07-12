import { getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailsBatch } from "@/lib/nexon/cached";
import { NexonApiError } from "@/lib/nexon/client";
import ShotMap, { detectGoalCode, type ShotMapShot } from "@/app/components/ShotMap";
import {
  aggregatePlaystyle,
  analyzePlaystyle,
  type Axis,
  type PlaystyleResult,
} from "@/lib/playstyle";

const MATCH_COUNT = 30;

const CONF_LABEL: Record<PlaystyleResult["confidence"], string> = {
  hold: "데이터 부족",
  low: "신뢰도 낮음",
  ok: "신뢰도 보통",
};

export default async function PlaystyleSection({
  ouid,
  matchType,
}: {
  ouid: string;
  matchType: number;
}) {
  let matchIds: string[] = [];
  try {
    matchIds = await getUserMatches(ouid, matchType, MATCH_COUNT);
  } catch (err) {
    if (!(err instanceof NexonApiError)) throw err;
  }
  const details = await getMatchDetailsBatch(matchIds);
  const result = analyzePlaystyle(aggregatePlaystyle(details, ouid));

  // 누적 슛 히트맵 — 최근 경기 내 내 슛 위치 (아키타입 시각 근거)
  const shots: ShotMapShot[] = [];
  for (const d of details) {
    const mine = d.matchInfo?.find((e) => e.ouid === ouid);
    if (!mine) continue;
    const goalCode = detectGoalCode([
      {
        shots: mine.shootDetail ?? [],
        goals: mine.shoot?.goalTotalDisplay ?? mine.shoot?.goalTotal ?? 0,
      },
    ]);
    for (const s of mine.shootDetail ?? []) {
      shots.push({
        x: s.x,
        y: s.y,
        isGoal: goalCode !== null && s.result === goalCode,
        hitPost: s.hitPost,
        label: "",
      });
    }
  }

  if (result.confidence === "hold") {
    return (
      <div className="panel mt-4 px-6 py-14 text-center text-sm text-muted">
        플레이스타일을 분석하려면 경기가 더 필요해요. (유효 {result.games}경기 /
        최소 5경기)
      </div>
    );
  }

  const a = result.archetype;

  return (
    <div className="mt-4">
      {/* 아키타입 히어로 카드 */}
      <section className="panel relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="scoreboard text-[13px] font-bold tracking-[0.2em] text-accent">
            MY PLAYSTYLE
          </span>
          <span className="rounded bg-surface-2 px-2 py-0.5 text-[13px] font-semibold text-muted">
            {CONF_LABEL[result.confidence]}
          </span>
          <span className="rounded bg-gold/15 px-2 py-0.5 text-[13px] font-bold text-gold">
            BETA
          </span>
          {result.controller !== "unknown" && (
            <span className="rounded bg-surface-2 px-2 py-0.5 text-[13px] text-muted">
              {result.controller === "keyboard" ? "⌨ 키보드" : result.controller === "pad" ? "🎮 패드" : result.controller}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{a.name}</h2>
        <p className="mt-1 text-sm text-muted">{a.tagline}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p className="text-sm">
            <span className="font-semibold text-win">강점</span>{" "}
            <span className="text-muted">{a.baseStrength}</span>
          </p>
          <p className="text-sm">
            <span className="font-semibold text-lose">취약</span>{" "}
            <span className="text-muted">{a.baseWeakness}</span>
          </p>
        </div>
        {result.confidence === "low" && (
          <p className="mt-3 text-[13px] text-muted">
            유효 {result.games}경기 기준 — 경기가 더 쌓이면 정확도가 올라갑니다.
          </p>
        )}
      </section>

      {/* 축 (양극 슬라이더 + 게이지) */}
      <section className="panel mt-3 space-y-4 p-5">
        <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
          플레이 성향
        </p>
        {result.axes.map((ax) => (
          <AxisBar key={ax.key} ax={ax} />
        ))}
        <p className="text-[13px] text-muted">
          측정 축은 성향(주황)일 뿐 실력이 아닙니다. 아래 강점·취약이 실력 지표예요.
        </p>
      </section>

      {/* 강점 / 취약 칩 */}
      {result.chips.length > 0 && (
        <section className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="panel p-4">
            <p className="text-[13px] font-semibold text-win">강점</p>
            <ul className="mt-2 space-y-1.5">
              {result.chips.filter((c) => c.kind === "strength").map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="text-win">▲</span> {c.text}
                </li>
              ))}
              {result.chips.every((c) => c.kind !== "strength") && (
                <li className="text-sm text-muted">두드러진 강점 데이터 없음</li>
              )}
            </ul>
          </div>
          <div className="panel p-4">
            <p className="text-[13px] font-semibold text-lose">취약</p>
            <ul className="mt-2 space-y-1.5">
              {result.chips.filter((c) => c.kind === "weakness").map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="text-lose">▼</span> {c.text}
                </li>
              ))}
              {result.chips.every((c) => c.kind !== "weakness") && (
                <li className="text-sm text-muted">두드러진 취약점 없음 — 안정적</li>
              )}
            </ul>
          </div>
        </section>
      )}

      {/* 누적 슛 히트맵 */}
      {shots.length > 0 && (
        <section className="mt-3">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            내 슛 히트맵 ({shots.length}개)
          </p>
          <div className="mt-2">
            <ShotMap shots={shots} tone="lime" />
          </div>
          <p className="mt-2 text-[13px] text-muted">
            ● 채움=골 · ○ 외곽선=노골 · 박스 안 집중이면 포처형, 외곽 분산이면 난사형
          </p>
        </section>
      )}

      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        최근 {result.games}경기 기준 · 룰베이스 진단(AI 미사용) · 코호트 데이터가
        쌓이면 등급대 상대 비교로 정밀해집니다.
      </p>
    </div>
  );
}

function AxisBar({ ax }: { ax: Axis }) {
  const v = Math.round(ax.value);
  return (
    <div className={ax.lowConf ? "opacity-45" : ""}>
      <div className="flex items-baseline justify-between text-[13px]">
        {ax.bipolar ? (
          <>
            <span className="text-muted">{ax.leftLabel}</span>
            <span className="scoreboard font-bold text-accent">{ax.label}</span>
            <span className="text-muted">{ax.rightLabel}</span>
          </>
        ) : (
          <>
            <span className="scoreboard font-bold text-accent">{ax.label}</span>
            <span className="scoreboard font-semibold text-muted">
              {ax.lowConf ? "측정 보류" : v}
            </span>
          </>
        )}
      </div>
      <div className="relative mt-1.5 h-2.5 rounded-full bg-surface-2">
        {ax.bipolar ? (
          // 양극: 마커 위치
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-accent"
            style={{ left: `${v}%` }}
          />
        ) : (
          // 단극: 채움 게이지
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${v}%` }}
          />
        )}
      </div>
    </div>
  );
}
