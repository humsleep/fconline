import { VERDICT_BG_CLASS, type Verdict } from "@/lib/verdict";

/**
 * 심판 도장 — verdict를 색 + 형태(icon) 이중 인코딩으로 표시(색맹 대응).
 * size: sm(카드용) / lg(리포트 히어로용)
 */
export default function VerdictStamp({
  verdict,
  size = "sm",
  showLiner = false,
}: {
  verdict: Verdict;
  size?: "sm" | "lg";
  showLiner?: boolean;
}) {
  const lg = size === "lg";
  const glow = verdict.color === "gold" || verdict.color === "lime";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`scoreboard inline-flex items-center gap-1 rounded-md font-bold ${
          VERDICT_BG_CLASS[verdict.color]
        } ${lg ? "px-3 py-1.5 text-base" : "px-2 py-1 text-xs"} ${
          glow ? "ring-1 ring-inset ring-current/30" : ""
        }`}
        style={glow ? { boxShadow: "0 0 12px -4px currentColor" } : undefined}
      >
        <span aria-hidden>{verdict.icon}</span>
        {verdict.grade}
      </span>
      {showLiner && (
        <span className={`${lg ? "text-sm" : "text-[11px]"} text-muted`}>
          {verdict.oneLiner}
        </span>
      )}
    </div>
  );
}
