import { ImageResponse } from "next/og";

// 루트 OG 이미지 — 카카오톡/네이버/트위터 공유 미리보기용.
// 아이콘(lib/icon.tsx)과 동일한 브랜드 심볼·컬러. 한글 폰트 로드 없이
// 영문 워드마크만 사용해 tofu(□) 방지.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "FC Scope — FC온라인 전적·스쿼드 진단 랩";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background:
            "radial-gradient(120% 120% at 50% 0%, #16324a 0%, #0a1119 70%)",
          color: "#eef2f8",
          fontFamily: "sans-serif",
        }}
      >
        <svg width={168} height={168} viewBox="0 0 100 100" fill="none">
          <path
            d="M41 15 L41 38 M59 15 L59 38"
            stroke="#c8f542"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M35 15 L65 15"
            stroke="#c8f542"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="63"
            r="30"
            fill="#0a1119"
            stroke="#c8f542"
            strokeWidth="6"
          />
          <polygon
            points="50,50 61.4,58.3 57.1,71.8 42.9,71.8 38.6,58.3"
            fill="#c8f542"
          />
          <path
            d="M50,50 L50,37 M61.4,58.3 L73,54 M57.1,71.8 L64,84 M42.9,71.8 L36,84 M38.6,58.3 L27,54"
            stroke="#c8f542"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: "-2px",
          }}
        >
          <span style={{ color: "#c8f542" }}>FC</span>
          <span style={{ color: "#eef2f8" }}>SCOPE</span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 500,
            color: "#9fb0c3",
            letterSpacing: "0.5px",
          }}
        >
          FC Online Stats · AI Squad Lab · Ranker Data
        </div>
      </div>
    ),
    { ...size }
  );
}
