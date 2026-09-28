import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// 2026-09-28: 미국발 크롤러가 트래픽의 96% 를 차지해 Vercel 한도를 넘겼다.
// AI 학습·수집 봇은 전부 막고, 검색 노출에 필요한 봇만 남긴다.
// (robots 를 무시하는 봇은 Cloudflare 쪽에서 막는다 — docs/CLOUDFLARE.md)
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "Google-Extended",
  "meta-externalagent",
  "FacebookBot",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "DataForSeoBot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/profile/", "/qr"],
      },
      { userAgent: AI_BOTS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
