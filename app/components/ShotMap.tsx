import type { ShootDetail } from "@/lib/nexon/types";

export interface ShotMapShot {
  x: number;
  y: number;
  isGoal: boolean;
  hitPost: boolean;
  label: string; // 툴팁: "12' 손흥민 — 골"
}

// 골 코드 판별은 lib 로 옮겼다(자책골 오판 수정). 기존 import 경로 호환용 재수출.
export { detectGoalCode } from "@/lib/nexon/goal-code";

/** 좌표가 0~1 정규화 범위를 벗어나면 최대값 기준으로 자동 스케일 */
function normalize(shots: { x: number; y: number }[]) {
  const maxX = Math.max(1, ...shots.map((s) => Math.abs(s.x)));
  const maxY = Math.max(1, ...shots.map((s) => Math.abs(s.y)));
  const sx = maxX > 1.5 ? maxX : 1;
  const sy = maxY > 1.5 ? maxY : 1;
  return shots.map((s) => ({
    nx: Math.min(1, Math.max(0, s.x / sx)),
    ny: Math.min(1, Math.max(0, s.y / sy)),
  }));
}

const W = 105;
const H = 68;

/** 풀 피치 슛맵 (서버 렌더 SVG, <title>로 네이티브 툴팁) */
export default function ShotMap({
  shots,
  tone = "lime",
}: {
  shots: ShotMapShot[];
  tone?: "lime" | "rose";
}) {
  const pos = normalize(shots);
  const color = tone === "lime" ? "var(--accent)" : "var(--lose)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-lg border border-line bg-surface-2/60"
      role="img"
      aria-label="슛 위치 맵"
    >
      {/* 피치 라인 */}
      <g stroke="var(--accent)" strokeOpacity="0.22" strokeWidth="0.5" fill="none">
        <rect x="2" y="2" width={W - 4} height={H - 4} rx="1" />
        <line x1={W / 2} y1="2" x2={W / 2} y2={H - 2} />
        <circle cx={W / 2} cy={H / 2} r="8" />
        {/* 페널티 박스 (좌/우) */}
        <rect x="2" y={H / 2 - 17} width="14" height="34" />
        <rect x={W - 16} y={H / 2 - 17} width="14" height="34" />
        <rect x="2" y={H / 2 - 8} width="5" height="16" />
        <rect x={W - 7} y={H / 2 - 8} width="5" height="16" />
      </g>

      {/* 슛 마커 */}
      {shots.map((s, i) => {
        const { nx, ny } = pos[i];
        const cx = 2 + nx * (W - 4);
        const cy = 2 + ny * (H - 4);
        return (
          <g key={i}>
            <title>{s.label}</title>
            {s.isGoal ? (
              <>
                <circle cx={cx} cy={cy} r="2.6" fill={color} opacity="0.25" />
                <circle cx={cx} cy={cy} r="1.5" fill={color} />
              </>
            ) : (
              <circle
                cx={cx}
                cy={cy}
                r="1.3"
                fill="none"
                stroke={s.hitPost ? "var(--gold)" : color}
                strokeOpacity={s.hitPost ? 0.95 : 0.55}
                strokeWidth="0.5"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
