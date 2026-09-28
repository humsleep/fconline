import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

// ISR/데이터 캐시를 Workers KV 에 둔다(무료 플랜 포함).
// 이걸 빼면 revalidate 가 붙은 라우트(sitemap, /api/v1/player-index 등)가
// 매 요청마다 오리진 계산을 다시 한다.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
