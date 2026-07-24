import 'server-only';
import { getAdmin } from '@/lib/supabase/admin';

/**
 * 검색된 구단주명을 best-effort로 기록 (sitemap 색인 시드).
 * - fire-and-forget: 절대 렌더를 막지 않음(실패/미설정 무시)
 * - 대소문자 무시 dedup, hits 증가 + last_seen 갱신
 * - search_log 테이블(0016) 미실행 시 조용히 무시
 */
export function logNicknameSearch(nickname: string): void {
  const name = nickname.trim();
  if (!name) return;
  const db = getAdmin();
  if (!db) return;
  void db
    .from('search_log')
    .upsert(
      {
        nickname_lower: name.toLowerCase(),
        nickname: name,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'nickname_lower' }
    )
    .then(undefined, () => {
      // 테이블 없음/네트워크 실패 등 — 색인 시드는 부가 기능이라 조용히 무시
    });
}
