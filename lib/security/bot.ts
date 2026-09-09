import 'server-only';

/**
 * 크롤러/미리보기 봇 User-Agent 판별.
 *
 * 봇을 구분하는 이유는 차단이 아니라 **비용**이다.
 * `/user` 는 동적 SSR 이라 크롤 1회당 넥슨 최대 36콜 + `match_cache` 쓰기를 유발한다.
 * sitemap 이 프로필 500개를 `daily` 로 광고하므로, 한 번의 크롤 패스가
 * 넥슨 API 를 수천 번 두드리고 캐시 테이블을 부풀린다.
 *
 * 봇에게는 **이미 캐시된 데이터만** 보여준다(`lib/nexon/recent.ts` cacheOnly).
 * sitemap 에 오르는 닉네임은 `search_log` 에서 오고, search_log 는 사람 검색만 기록하므로
 * 그 프로필의 경기는 대개 이미 캐시에 있다 → 실제 색인 품질 손실은 작다.
 */
const BOT_UA_RE =
  /(bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|preview|headless|monitor|scanner|curl|wget|python-requests|node-fetch|axios)/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && BOT_UA_RE.test(userAgent));
}
