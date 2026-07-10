import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FC Scope — FC온라인 데이터 랩",
    short_name: "FC Scope",
    description: "FC온라인 전적·슛맵·랭커 비교·라이브 세션 분석",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1119",
    theme_color: "#0a1119",
    orientation: "portrait",
    lang: "ko",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
