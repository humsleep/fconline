import { ImageResponse } from "next/og";

// FC SCOPE 심볼 — 구형 플라스크(연구실)의 둥근 몸통 = 축구공.
// 넥슨 없이 코드로 생성, maskable 대응(풀블리드 배경 + 중앙 안전영역).
export function iconResponse(size: number): ImageResponse {
  const s = 100; // viewBox
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(120% 120% at 50% 0%, #16324a 0%, #0a1119 70%)",
        }}
      >
        <svg
          width={size * 0.72}
          height={size * 0.72}
          viewBox={`0 0 ${s} ${s}`}
          fill="none"
        >
          {/* 플라스크 목 + 입구 */}
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
          {/* 둥근 몸통 = 축구공 */}
          <circle cx="50" cy="63" r="30" fill="#0a1119" stroke="#c8f542" strokeWidth="6" />
          {/* 중앙 오각형 (축구공 상징) */}
          <polygon
            points="50,50 61.4,58.3 57.1,71.8 42.9,71.8 38.6,58.3"
            fill="#c8f542"
          />
          {/* 씨임 라인 */}
          <path
            d="M50,50 L50,37 M61.4,58.3 L73,54 M57.1,71.8 L64,84 M42.9,71.8 L36,84 M38.6,58.3 L27,54"
            stroke="#c8f542"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
