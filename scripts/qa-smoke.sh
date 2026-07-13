#!/usr/bin/env bash
# FC Scope 통합 스모크 — 프로덕션 서버에 실제 HTTP 요청을 보내 상태 코드/응답을 검증.
# 넥슨 API가 차단된 환경에서도 "크래시(500) 없이 graceful 처리"되는지 확인하는 것이 목적.
# 실행: BASE=http://localhost:3500 bash scripts/qa-smoke.sh  (서버가 이미 떠 있어야 함)
# 인증 라우트(401/403) 검증은 Supabase env가 있어야 정상 — 없으면 createClient가 throw해 500.
#   로컬 검증 시: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (더미라도) + NEXON_API_KEY 설정.
set -u
BASE="${BASE:-http://localhost:3500}"
pass=0
fail=0

# code <경로> <기대 상태코드> <설명>
code() {
  local path="$1" want="$2" desc="$3"
  local got
  got=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  if [ "$got" = "$want" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); echo "  ✗ [$got≠$want] $desc ($path)"
  fi
}

# contains <경로> <문자열> <설명>
contains() {
  local path="$1" needle="$2" desc="$3"
  if curl -s "$BASE$path" | grep -q "$needle"; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); echo "  ✗ [본문에 '$needle' 없음] $desc ($path)"
  fi
}

# code_in <경로> <기대코드들(공백구분)> <설명> — graceful 처리(크래시 아님) 확인용
code_in() {
  local path="$1" wants="$2" desc="$3"
  local got
  got=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  case " $wants " in
    *" $got "*) pass=$((pass+1)) ;;
    *) fail=$((fail+1)); echo "  ✗ [$got not in ($wants)] $desc ($path)" ;;
  esac
}

# post_code <경로> <기대 상태코드> <설명>
post_code() {
  local path="$1" want="$2" desc="$3"
  local got
  got=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{}' "$BASE$path")
  if [ "$got" = "$want" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); echo "  ✗ [$got≠$want] $desc ($path)"
  fi
}

echo "SMOKE @ $BASE"

# 정적/공개 페이지 — 200
code "/" 200 "홈"
code "/squad" 200 "스쿼드 빌더"
code "/community" 200 "커뮤니티 허브"
code "/meta" 200 "픽 랭킹"
code "/terms" 200 "이용약관"
code "/privacy" 200 "개인정보처리방침"
code "/login" 200 "로그인"

# SEO
code "/sitemap.xml" 200 "sitemap"
contains "/sitemap.xml" "urlset" "sitemap XML 구조"
code "/robots.txt" 200 "robots"

# 선수 검색(넥슨 아님, spid.json 인덱스) — 넥슨 차단 시 빈 배열이라도 200
code "/api/players/search?q=%EC%86%90" 200 "선수 검색 API"

# 넥슨 팬아웃 경로 — 차단 환경에서도 크래시(500) 금지, graceful 처리
# /user 페이지: 존재하지 않는 닉네임 → ErrorState 렌더(200)
code "/user/__qa_nonexistent__" 200 "전적 페이지 graceful 에러"
# 라이브 API: JSON 에러 응답(404/503/500 중 하나 — 넥슨 상태에 따라 graceful, 무한대기 아님)
code_in "/api/live/__qa_nonexistent__" "404 500 503" "라이브 API graceful 처리"

# 관리자 — 비로그인은 노출 금지(404 fail-closed)
code "/admin" 404 "관리자 콘솔 은닉"

# 카드 라우트 — 없는 스쿼드는 404 (크래시 아님)
code "/api/card/squad/__qa_nonexistent__" 404 "스쿼드 카드 미존재"

# 쓰기 API — 비로그인 차단
post_code "/api/community/posts" 401 "글 작성 비로그인 차단"
post_code "/api/profile" 401 "프로필 저장 비로그인 차단"
post_code "/api/admin/service-flag" 403 "kill-switch 비관리자 차단"

echo ""
echo "스모크: $pass PASS, $fail FAIL"
[ "$fail" -eq 0 ] && echo "✓ 전부 통과" || exit 1
