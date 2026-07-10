import { ImageResponse } from "next/og";

// 바이너리 에셋 없이 앱 아이콘 생성 (스타디움 나이트: 네이비 바탕 + 라임 FC).
// maskable 대응: 배경 풀블리드 + 중앙 안전영역.
export function iconResponse(size: number): ImageResponse {
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
          color: "#c8f542",
          fontSize: size * 0.46,
          fontWeight: 800,
          letterSpacing: -size * 0.02,
          fontFamily: "sans-serif",
        }}
      >
        FC
      </div>
    ),
    { width: size, height: size }
  );
}
