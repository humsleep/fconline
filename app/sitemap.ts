import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getAdmin } from "@/lib/supabase/admin";

const BASE = SITE_URL;

// 하루 1회 재생성 — 크롤마다 DB를 때리지 않도록 ISR
export const revalidate = 86400;

const MAX_SQUADS = 2000;
const MAX_POSTS = 2000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/meta`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/squad`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/community`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.1 },
  ];

  const db = getAdmin();
  if (!db) return staticEntries;

  const dynamic: MetadataRoute.Sitemap = [];
  try {
    const { data: squads } = await db
      .from("squads")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_SQUADS);
    for (const s of squads ?? [])
      dynamic.push({
        url: `${BASE}/squad/${s.id}`,
        lastModified: s.created_at ?? undefined,
        changeFrequency: "monthly",
        priority: 0.5,
      });
  } catch {
    // 스쿼드 조회 실패 — 정적 항목만
  }

  try {
    const { data: posts } = await db
      .from("community_posts")
      .select("id, created_at")
      .eq("hidden", false) // service_role은 RLS 우회 → 숨김 글 노출 방지 위해 명시 필터
      .order("created_at", { ascending: false })
      .limit(MAX_POSTS);
    for (const p of posts ?? [])
      dynamic.push({
        url: `${BASE}/community/${p.id}`,
        lastModified: p.created_at ?? undefined,
        changeFrequency: "weekly",
        priority: 0.6,
      });
  } catch {
    // 커뮤니티 조회 실패 — 정적 + 스쿼드만
  }

  return [...staticEntries, ...dynamic];
}
