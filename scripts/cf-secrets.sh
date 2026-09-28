#!/usr/bin/env bash
# .env.local 의 서버 전용 값을 Cloudflare Workers 시크릿으로 등록한다.
#
#   bash scripts/cf-secrets.sh            # 본체(fcscope)
#   bash scripts/cf-secrets.sh cron       # 크론 워커(CRON_SECRET 만)
#
# NEXT_PUBLIC_* 는 빌드 시점에 코드로 들어가므로 시크릿이 아니다(.env.local 에만 있으면 된다).
# 값은 화면에 출력하지 않는다.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.local ] || { echo ".env.local 이 없습니다"; exit 1; }

KEYS=(SUPABASE_SERVICE_ROLE_KEY NEXON_API_KEY ADMIN_EMAILS IP_HASH_SALT CRON_SECRET
      ADMOB_PUBLISHER_ID APPLE_TEAM_ID APPLE_SIWA_KEY_ID APPLE_SIWA_PRIVATE_KEY
      APNS_KEY_ID APNS_TEAM_ID APNS_PRIVATE_KEY APNS_BUNDLE_ID APNS_SANDBOX)
# set -u 에서 빈 배열 전개가 터지므로 문자열로 다룬다.
CONFIG=""
if [ "${1:-}" = "cron" ]; then
  KEYS=(CRON_SECRET)
  CONFIG="workers/cron/wrangler.jsonc"
fi

for k in "${KEYS[@]}"; do
  v="$(grep -E "^${k}=" .env.local | head -1 | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"
  if [ -z "$v" ] || [ "$v" = "PASTE_HERE" ] || [ "$v" = "[SENSITIVE]" ]; then
    echo "건너뜀  $k (값 없음)"
    continue
  fi
  if [ -n "$CONFIG" ]; then
    printf '%s' "$v" | npx wrangler secret put "$k" -c "$CONFIG" >/dev/null 2>&1 && echo "등록함  $k" || echo "실패    $k"
  else
    printf '%s' "$v" | npx wrangler secret put "$k" >/dev/null 2>&1 && echo "등록함  $k" || echo "실패    $k"
  fi
done
