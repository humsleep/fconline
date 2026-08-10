import 'server-only';
import { getAdmin } from '@/lib/supabase/admin';
import { guardDb } from '@/lib/supabase/circuit';

/** 크롤러/미리보기 봇 User-Agent 판별(대략). 봇은 search_log 시드에서 제외. */
const BOT_UA_RE =
  /(bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|preview|headless|monitor|scanner|curl|wget|python-requests|node-fetch|axios)/i;

/**
 * 검색된 구단주명을 best-effort로 기록 (sitemap 색인 시드).
 * - fire-and-forget: 절대 렌더를 막지 않음(실패/미설정 무시)
 * - 대소문자 무시 dedup, hits 증가 + last_seen 갱신
 * - search_log 테이블(0016) 미실행 시 조용히 무시
 * - 봇 UA는 제외: 크롤러는 이미 sitemap에 있는 URL을 재크롤 → 재시드는 무의미한
 *   쓰기 IO일 뿐(사람이 새로 검색한 닉네임만 시드 가치). NANO Disk IO 절감.
 */
export function logNicknameSearch(nickname: string, userAgent?: string | null): void {
  const name = nickname.trim();
  if (!name) return;
  if (userAgent && BOT_UA_RE.test(userAgent)) return;
  const db = getAdmin();
  if (!db) return;
  // 서킷 브레이커 경유 — DB 불통 시 즉시 skip(재연결 폭풍 방지). 실패는 조용히 무시.
  void guardDb(() =>
    db.from('search_log').upsert(
      {
        nickname_lower: name.toLowerCase(),
        nickname: name,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'nickname_lower' }
    )
  );
}

/**
 * 최근 검색된 구단주명 — 홈 "지금 검색되는" 라이브 칩(첫인상 활력).
 * last_seen 내림차순. 실패/미설정/서킷오픈 시 빈 배열(렌더 안 막음).
 * 홈은 ISR(revalidate=3600)이라 1시간 1쿼리 — 부하 무시 가능.
 */
export async function getRecentSearches(limit = 12): Promise<string[]> {
  const db = getAdmin();
  if (!db) return [];
  const res = await guardDb(() =>
    db
      .from('search_log')
      .select('nickname, last_seen')
      .order('last_seen', { ascending: false })
      .limit(limit)
  );
  if (!res || res.error || !res.data) return [];
  return res.data.map((r) => r.nickname as string).filter(Boolean);
}
