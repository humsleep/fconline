import type { RuleTone } from "../market/diagnosis";

/** 진단 룰 tone → Tailwind 클래스 (이적시장/공식경기 진단 공용) */
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
