import type { VerdictColor } from "@/lib/verdict";

/**
 * 공유 카드·OG 이미지 팔레트 — iOS `CardPalette`(ShareCard.swift)와 같은 값.
 * 카드는 뷰어 테마와 무관하게 항상 다크로 그린다.
 * 브랜드 그라디언트는 워드마크 "FC"·히어로 강조에만. 데이터 숫자는 의미색(win/lose/gold)이나 ink.
 */
export const CARD = {
  bg: "#0b0a1f",
  surface: "#14122e",
  surface2: "#1d1a40",
  line: "#2a2656",
  ink: "#eeedf8",
  muted: "#a6a2c8",
  tint: "#9b7bff",
  win: "#3ddc97",
  lose: "#ff5470",
  gold: "#f7c948",
  brandStart: "#f0502a",
  brandEnd: "#e0218a",
} as const;

export const BRAND_GRADIENT = `linear-gradient(90deg, ${CARD.brandStart}, ${CARD.brandEnd})`;

/** 상단 은은한 마젠타 글로(iOS EllipticalGradient brandEnd 18%). */
export const CARD_GLOW = "radial-gradient(900px 560px at 50% 0%, rgba(224,33,138,0.18), transparent)";

/** 서버 VerdictColor → 카드 색. 'lime'(옛 브랜드색)은 의미상 "좋음"이라 win 으로 그린다(iOS verdict() 와 동일). */
export const VERDICT_HEX: Record<VerdictColor, string> = {
  gold: CARD.gold,
  lime: CARD.win,
  ink: CARD.ink,
  muted: CARD.muted,
  lose: CARD.lose,
};

/** "FC SCOPE" 워드마크 — FC 만 브랜드 그라디언트(텍스트 클립). */
export function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(size * 0.3) }}>
      <span
        style={{
          fontSize: size,
          fontWeight: 700,
          backgroundImage: BRAND_GRADIENT,
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        FC
      </span>
      <span style={{ fontSize: size, fontWeight: 700, color: CARD.ink }}>SCOPE</span>
    </div>
  );
}
