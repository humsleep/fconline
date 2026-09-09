/**
 * 진단 룰의 톤(색) 정의 — 공식경기 진단(lib/match/diagnosis.ts) 공용.
 *
 * 원래 이 타입은 lib/market/diagnosis.ts 에 있었으나, 이적시장 기능 제거(2026-09-04)로
 * 중립 위치인 여기로 옮겼다.
 */
export type RuleTone = "win" | "lose" | "gold" | "info";

/** 진단 룰 tone → Tailwind 클래스 */
export const TONE_TEXT: Record<RuleTone, string> = {
  win: "text-win",
  lose: "text-lose",
  gold: "text-gold",
  info: "text-accent",
};

export const TONE_BG: Record<RuleTone, string> = {
  win: "bg-win/15",
  lose: "bg-lose/15",
  gold: "bg-gold/15",
  info: "bg-accent/15",
};

export const TONE_DOT: Record<RuleTone, string> = {
  win: "bg-win",
  lose: "bg-lose",
  gold: "bg-gold",
  info: "bg-accent",
};
