import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getAdmin } from "@/lib/supabase/admin";
import { getAllPlayerReps } from "@/lib/nexon/players";

const BASE = SITE_URL;

// 하루 1회 재생성 — 크롤마다 DB를 때리지 않도록 ISR
export const revalidate = 86400;

const MAX_SQUADS = 2000;
const MAX_POSTS = 2000;
const MAX_PLAYERS = 8000; // 실선수 대표 카드 (사이트맵 5만 URL 상한 내)
const MAX_USERS = 5000; // 최근 검색된 구단주 프로필

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

  // 선수 도감 — 실선수 1명당 대표 카드(최신 시즌). "[선수명] FC온라인" 롱테일 색인.
  try {
    const reps = await getAllPlayerReps();
    for (const p of reps.slice(0, MAX_PLAYERS))
      dynamic.push({
        url: `${BASE}/player/${p.spid}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
  } catch {
    // 넥슨 메타 실패 — 선수 항목 없이 진행
  }

  // 검색된 구단주 프로필 — op.gg식 프로필 SEO 엔진 (search_log, 0016 미실행 시 skip)
  try {
    const { data: users } = await db
      .from("search_log")
      .select("nickname, last_seen")
      .order("last_seen", { ascending: false })
      .limit(MAX_USERS);
    for (const u of users ?? [])
      dynamic.push({
        url: `${BASE}/user/${encodeURIComponent(u.nickname as string)}`,
        lastModified: (u.last_seen as string) ?? undefined,
        changeFrequency: "daily",
        priority: 0.7,
      });
  } catch {
    // search_log 미생성/조회 실패 — 프로필 항목 없이 진행
  }

  return [...staticEntries, ...dynamic];
}
