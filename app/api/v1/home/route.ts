import { getRecentSearches } from '@/lib/search-log';
import { loadPicks, pickTopMover, LINE_TITLE } from '@/lib/meta/picks';
import { getPlayerNames, getSeasonNames } from '@/lib/nexon/players';
import { getPositionLabel } from '@/lib/nexon/meta';
import { loadVideos } from '@/lib/youtube/feed';
import { FCONLINE_CHANNELS } from '@/lib/youtube/channels';
import { DEMO_NICKNAME } from '@/lib/demo';
import { getAdmin } from '@/lib/supabase/admin';
import { ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

/** GET /api/v1/home — 앱 홈 대시보드(지금 검색되는 구단주·오늘의 급상승·최신 커뮤니티·영상). */
export async function GET() {
  const [recent, picks, videos, posts] = await Promise.all([
    getRecentSearches(12).catch(() => []),
    loadPicks().catch(() => ({ date: null, byLine: new Map() })),
    loadVideos(FCONLINE_CHANNELS, 6).catch(() => []),
    latestPosts(),
  ]);
  const mover = pickTopMover(picks.byLine);
  let moverOut = null;
  if (mover) {
    // season 은 앱 계약(Mover)에서 필수다. 빠지면 Swift Decodable 이 홈 응답 전체를 버린다
    // — 2026-09-28 verify:api 로 발견(그전엔 mover 가 null 이라 드러나지 않았다). /api/v1/meta 와 같은 방식.
    const [names, seasons] = await Promise.all([
      getPlayerNames([mover.spId]),
      getSeasonNames([mover.spId]),
    ]);
    moverOut = {
      ...mover,
      name: names.get(mover.spId) ?? `선수 ${mover.spId}`,
      season: seasons.get(mover.spId) ?? '',
      positionLabel: getPositionLabel(mover.position),
      lineTitle: LINE_TITLE[mover.line as keyof typeof LINE_TITLE] ?? mover.line,
      imageUrl: `/api/player-image/${mover.spId}`,
    };
  }
  return ok({ demoNickname: DEMO_NICKNAME || null, liveSearches: recent, mover: moverOut, pickDate: picks.date, videos, posts }, 300);
}

async function latestPosts() {
  const db = getAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from('community_posts')
      .select('id, type, title, created_at, comment_count, author_id')
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(5);
    return data ?? [];
  } catch {
    return [];
  }
}
