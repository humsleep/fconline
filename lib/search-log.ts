import 'server-only';
import { getAdmin } from '@/lib/supabase/admin';
import { guardDb } from '@/lib/supabase/circuit';
import { isBot } from '@/lib/security/bot';

/**
 * 검색된 구단주명을 best-effort로 기록 (sitemap 색인 시드).
 * - fire-and-forget: 절대 렌더를 막지 않음(실패/미설정 무시)
 * - 대소문자 무시 dedup, hits 증가 + last_seen 갱신
 * - search_log 테이블(0016) 미실행 시 조용히 무시
 * - 봇 UA는 제외: 크롤러는 이미 sitemap에 있는 URL을 재크롤 → 재시드는 무의미한
 *   쓰기 IO일 뿐(사람이 새로 검색한 닉네임만 시드 가치). NANO Disk IO 절감.
 */
// 인스턴스 로컬 스로틀 — 같은 닉네임을 1시간 안에 다시 기록하지 않는다.
// sitemap 은 last_seen 순 상위 500개만 쓰므로 분 단위 정확도가 필요 없고,
// 인기 프로필이 하루 수백 번 조회되면 그대로 수백 번의 쓰기가 되던 것을 막는다.
const LOG_TTL_MS = 3_600_000;
const MAX_TRACKED = 5_000;
const recentlyLogged = new Map<string, number>();

export function logNicknameSearch(nickname: string, userAgent?: string | null): void {
  const name = nickname.trim();
  if (!name) return;
  if (isBot(userAgent)) return;

  const key = name.toLowerCase();
  const now = Date.now();
  const last = recentlyLogged.get(key);
  if (last !== undefined && now - last < LOG_TTL_MS) return;
  if (recentlyLogged.size > MAX_TRACKED) {
    for (const [k, t] of recentlyLogged) if (now - t > LOG_TTL_MS) recentlyLogged.delete(k);
    // 정리 후에도 넘치면 가장 오래된 것부터 축출(Map 은 삽입 순서 보존)
    while (recentlyLogged.size > MAX_TRACKED) {
      const oldest = recentlyLogged.keys().next().value;
      if (oldest === undefined) break;
      recentlyLogged.delete(oldest);
    }
  }
  recentlyLogged.set(key, now);
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
