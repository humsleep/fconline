import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // 아이콘은 정적 파일(public/icon-*.png, app/icon.svg, app/apple-icon.png)이다 —
  // 런타임 ImageResponse 는 Worker CPU 를 쓴다. 옛 URL(구 매니페스트·북마크)은 리다이렉트로 유지.
  async redirects() {
    return [
      { source: "/icon-192", destination: "/icon-192.png", permanent: true },
      { source: "/icon-512", destination: "/icon-512.png", permanent: true },
      { source: "/icon", destination: "/icon.svg", permanent: true },
      { source: "/apple-icon", destination: "/apple-icon.png", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
