# DEVLOG

## 2026-08-24 — [주간 회의] 히어로 칩 회귀 수정 + 선수 검색 발견성 + 천적 복수전 배너

- 주간 개선 회의(4렌즈). 지난주(#88) 히어로 가치 칩의 확정 회귀 2건 수정 + 선수 검색 진입 + 라이벌 재방문 훅.
- **P0 발견성/첫방문(Lens1+2)**:
  - **히어로 "전적·슛맵" 칩 먹통** — `/?focus=1` Link는 홈에서 SearchForm remount 안 돼 focus effect 미실행(회귀). `FocusSearchCard`(onClick)로 교체 → 실측 클릭 시 `#hero-search` 포커스.
  - **칩 터치 36px→44px** (`min-h-9`→`min-h-11`, 규칙 위반 수정).
  - **선수 도감 발견성** — "🔎 선수 검색" 히어로 칩 + not-found에 `/meta?q=<name>` CTA + PlayerSearch `?q=` 프리필(window로 읽어 ISR 무영향). 구단주 검색이 선수명("손흥민")에서 막다른 길이던 것 회복. 실측 `/meta?q=메시` 프리필.
- **P1 재방문(Lens3)**: 천적 "복수전" 배너 — `RivalsPanel` 하단 배지를 리포트 최상단 "🎯 복수전" 배너로 승격 + `?vs=` 저격 카드. `pickNemesis()`를 `summary.ts`로 추출해 페이지·rival 라우트 규칙 공유. 마이그레이션·추가 팬아웃 0.
- **정합성(Lens4)**: 연승 배너 momentum-하락 케이스 문구 모순(빨강 "폼 하락 중"+🔥+"상승 중") → 이모지·부제를 `streak.color` 기준으로. 탭 주석 4→5. 화폐개혁(#90) 재감사 CLEAN(이중 환산 없음).
- 검증: `tsc` 0 · **231 PASS**(+7 pickNemesis) · build ✓ · Playwright 390px 칩 44px·전적 칩 포커스·5칩·오버플로 0. PR #92
- **다음 후보**: 홈 대시보드 폼 델타 배지(로그인) · 주간 메타 공유 카드 · 극소액 거래 "0" 표시 개선(LOW) · 시즌 테마 카드(디자인 패스).

## 2026-08-16 — [화폐개혁] 이적시장 재denomination (옛 1억 BP = 새 1 BP)

- 게임 화폐개혁 반영. 넥슨 `user/trade` API는 개혁 후에도 **옛 값 반환**(라이브가 1억배 큰 값 표시로 확인) → 이적시장 전 가격이 1억배 컸음.
- **`lib/nexon/bp.ts`(신규)**: 단일 진실 소스 `BP_REDENOM=1e8` + `toNewBp()`. 넥슨이 API를 새 화폐로 바꾸면 `BP_REDENOM=1`로 한 줄 원복(경계+임계값 동시).
- **`getUserTrades`**: 경계에서 `value/1e8` 환산 → 표시·차트·진단·성향 배지 전부 자동 적용.
- **`diagnosis.ts`**: `JO/GYEONG = (1e12|1e16)/BP_REDENOM`로 재정의 → 모든 임계값 한 곳에서 재조정. 조↔만·경↔억이 정확히 1e8 차라 규칙 배수(100*JO 등)는 그대로, 라벨 단위 글자만 조→만·경→억(유일 억 금액 "1,000억 BP"→"1,000 BP"). sed 숫자앵커로 비금액 조/경(조정·조심·경기 등) 보존. `computeMarketStats`·`formatKoreanBP`는 스케일 무관이라 무변경.
- 검증: `tsc` 0 · **224 PASS**(+8: toNewBp 환산 + 시장 임계값 새 스케일 재작성) · build ✓.
- **사용자 조치**: 마이그레이션·환경변수 불필요(읽는 시점 환산, 백필 없음). 넥슨이 이후 API를 새 화폐로 바꾸면 `BP_REDENOM`을 1로.

## 2026-08-14 — [주간 회의] 검색결과 탭 활성 + 히어로 가치 칩 + 연승 하이라이트 카드

- 주간 개선 회의(4렌즈). 정확성 렌즈 클린(tsc 0·216 테스트·회귀 없음).
- **P0 발견성(Lens1)**: `MobileTabBar` 전적 검색 탭이 `"/"`에서만 활성 → 모든 검색이 착지하는 `/user`(+`/match`·`/market`)에서 활성 탭 없음("여기가 어디" 앵커 상실). 매처를 검색결과 패밀리로 확장(지난주 메타 패밀리와 동일 패턴). Playwright로 활성 확인.
- **P1 첫방문(Lens2)**: 모바일 히어로 3초 가치 전달 실패 — 폴드 위 추상 슬로건+빈 검색창, 구체 가치는 폴드 아래+히어로 헬퍼는 신규자에게 전부 null. 검색창 아래 상시 가치 칩(전적·슛맵/스쿼드 빌더/픽 랭킹/메타 리포트) → 닉네임 없는 IG 콜드 유입도 즉시 누를 곳.
- **P1 재방문(Lens3)**: 연승/폼 하이라이트 — `computeMatchPerfStats`(이미 /user마다 계산)의 연승/모멘텀 활용. 순수 `lib/nexon/streak-card.ts`(`streakLabel`/`hasStreakHighlight`) → `/user` 히어로 배너(사건 있을 때만) + `/api/card/streak/[nickname]` 공유 카드(rival 파이프라인 복제). 연승=소멸값 → 재방문·재공유 훅. **마이그레이션 없음.**
- 검증: `tsc` 0 · **216 PASS**(+14) · build ✓(streak 라우트) · Playwright 390px `/user`·`/match`·`/market` 전적 검색 탭 활성·히어로 칩·오버플로 0. PR #88
- **다음 후보**: 천적 복수전 CTA 히어로 승격(무마이그레이션) · 홈 대시보드 폼 델타 배지(로그인) · FC 스코어 추세 그래프(score 컬럼 마이그레이션 필요) · 시즌 테마 카드(디자인 패스).

## 2026-08-09 — [인스타 런칭 P1·P2] GA4 퍼널 측정 + 라이브 검색 칩 + 홍보 QR

- 인스타 홍보 대비 나머지 세 항목.
- **P1 캠페인 측정**: `lib/client/analytics.ts` `track()`(GA4 커스텀 이벤트, `NEXT_PUBLIC_GA_ID` 미설정 시 no-op) + `captureUtm()`(랜딩 utm_* → localStorage + `campaign_landing`). `AnalyticsInit` layout 1회 마운트. `SearchForm`→`track('search',{from})`(닉네임 본문 PII 미전송), `ShareCardButton`→`track('card_share',{card})`. → IG→검색→카드공유 퍼널 GA4 측정.
- **P1 착지 라이브**: `RecentSearches`(서버, 홈) — `search_log`(last_seen desc) 최근 검색 구단주 칩. 표본<3 숨김. 홈 ISR 1h라 시간당 ~1쿼리. `getRecentSearches()` 리더(guardDb, 실패 시 []).
- **P2 홍보 QR**: `/qr` 운영자 도구 — 유입 소스별 UTM 프리셋(인스타 프로필/스토리/게시물·오프라인) QR 생성(클라 `qrcode`). robots 색인 제외.
- 검증: `tsc` 0 · **202 PASS** · build ✓(`/qr` 정적) · Playwright 390px `/`·`/qr` 오버플로 0 · QR 데이터URL 렌더 · GA 미설정 시 gtag 에러 없음. PR #86
- **의도적 보류**: 시즌 테마 카드 디자인 — 주관적 디자인 결정이라 추측 대신 별도 디자인 패스로 분리.
- **⚠️ 운영자 조치**: GA4 측정을 실제로 보려면 Vercel 환경변수 `NEXT_PUBLIC_GA_ID` 설정 필요(미설정 시 이벤트는 조용히 무시). 인스타 링크엔 `?utm_source=instagram&utm_medium=bio` 등을 붙여 배포.

## 2026-08-08 — [인스타 런칭 P0] 인앱 웹뷰 로그인 안내 + 공유 카드 유입 CTA

- 인스타그램 홍보 대비. 유입 퍼널: IG 링크 → 모바일 착지 → 검색 → 카드 생성 → 스토리 자랑+친구 태그 → 친구 유입 → 반복.
- **인앱 웹뷰 로그인 안내**: 인스타/페북 인앱 브라우저가 구글 OAuth를 차단(`disallowed_useragent`) → 로그인 막다른 길. `lib/client/in-app-browser.ts`(순수 감지) + `/login`에서 인앱 웹뷰(인스타/스레드/페북/카톡/네이버/라인) 감지 시 "⋯ → 외부 브라우저로 열기" 배너. 핵심 기능은 비로그인 동작이라 로그인 필요 사용자에게만 의미.
- **공유 카드 유입 워터마크**: 9:16 PNG 카드 푸터를 `fcscope`(맨) → "내 전적도 검색 → fcscope.xyz"(실제 도메인 `SITE_HOST`)로 강화. 리포스트 카드가 곧 광고 + 유입 CTA.
- 검증: `tsc` 0 · **202 PASS**(+10 인앱 감지) · build ✓ · Playwright 인스타 UA→배너·크롬 UA→미표시·390px 오버플로 0. PR #84
- **공유 배관은 이미 완비**(수정 불필요): `ShareCardButton`이 Web Share API(파일 공유)로 모바일 원탭 네이티브 공유(스토리 포함), 카드 1080×1920(9:16) 스토리 규격.
- **다음 후보(제안됨, 미착수)**: P1 캠페인 측정(GA4 `search`/`card_share` 이벤트 + UTM 캡처), 착지 화면 "인기/급상승" 라이브 노출 / P2 링크 스티커용 QR·짧은 랜딩, 시즌 테마 카드.

## 2026-08-08 — [부하·남용 방어] rate-limit 공백 차단 + 크롤 증폭 완화 + 요청당 중복 조회 제거

- 운영자 요청: 봇/크롤러/공격이 Vercel·Supabase에 일으키는 부하 방어 + 내부 낭비 제거. **SEO 크롤(저비용 페이지)은 유지.** 공격 표면·내부 부하 2-렌즈 병렬 감사.
- **rate-limit 메모리 캡 실제화**(`lib/security/rate-limit.ts`): 5만 상한이 만료 버킷만 지워 분산 다-IP 폭주 시 map 무한 성장 + 매 호출 O(n) 재스캔 → 상한 초과 시 oldest-resetAt 실제 축출.
- **카드 라우트 rate-limit 보강**: `card/rank`·`card/match`·`card/squad`에 `limitNexonFanout` 누락 → 임의 닉/matchId 반복으로 캐시미스 넥슨+DB쓰기 유발 가능했음. 형제 카드와 동일 버킷.
- **`players/search` 방어**: IP rate-limit + `q≥2자`(1자는 2MB 인덱스 전체 매칭 CPU 소모) + 결과 24 cap. 클라(메타/스쿼드빌더)도 2자 발동으로 정렬.
- **sitemap `MAX_USERS` 5000→500**: `/user`는 동적 SSR(콜드 크롤 1회당 넥슨 ~36콜+match_cache 최대 30쓰기)라 수천 광고 시 크롤 패스마다 Supabase 쓰기 폭증. 최근 활동만 노출(나머지 인바운드 링크 색인), 저비용 ISR 페이지는 유지. **튜닝 노브.**
- **섹션 중복 조회 제거**: SquadSection/Playstyle/Report가 HeroBadges의 `getRecentMatchDetails`(`cache()`) 우회 → 기본 탭 뷰마다 30행 match_cache SELECT 중복. 공유 조회로 라우팅.
- **`getSquad` `cache()` + `/squad/[id]` ISR(1일)**: metadata+본문 2회 SELECT→1회, 불변 행 매요청 조회→엣지 캐시.
- 검증: `tsc` 0 · **192 PASS** · build ✓ · players/search 1자→빈결과·40/분 초과→429 확인.
- **⚠️ 운영자 대시보드(코드 불가 — 서버리스 in-memory 리미터는 분산 공격에 약함)**: ①Vercel WAF rate-limit 규칙(`/api/card/*`·`/api/players/search`·`/api/squad/from-user`·`/api/profile/verify` 공격적, `/user/*`·OG 중간) ②검증 크롤러 allowlist(Googlebot/Naver Yeti는 rate-limit 예외 → SEO 보호) ③Attack Challenge Mode(공격 시만) ④Vercel 함수호출·Supabase write Spend/Usage 캡+알림.
- **정상 방어 확인(수정 불필요)**: 크론 `CRON_SECRET` fail-closed, admin `isAdminEmail` fail-closed, 커뮤니티 쓰기 auth+RLS 간격제한, 이미지 프록시 param 검증+미들웨어 제외, ISR 페이지.

## 2026-08-07 — [주간 회의] 라이벌 H2H 공유 카드 + 메타 패밀리 탭 활성화 + 콜드 조회 안내

- 주간 개선 회의(4렌즈 병렬: 모바일 발견성 / 첫방문 / 재방문·즐거움 / 정확성).
- **P1 재방문(Lens3, 플래그십)**: 라이벌 H2H 공유 카드 — `topRivals`가 이미 상대별 H2H·천적/호구 규칙 계산 중. 신규 `app/api/card/rival/[nickname]/route.tsx`가 `renderCard`(user 카드 파이프라인·rate-limit 동일) 재사용 → "나 vs OOO · 5:1 · 천적" OG 카드, `RivalsPanel`에 `ShareCardButton` 노출. 지목→검색 유입 바이럴 + 복수전 리텐션. **마이그레이션 없음.**
- **P0 발견성(Lens1)**: `MobileTabBar` 픽 랭킹 탭이 `/meta`만 매칭 → `/report/weekly`(구글 착지)·`/player` 도감이 활성 탭 없는 고아. 매칭을 메타 패밀리(`/meta`·`/report`·`/player`)로 확장. Playwright 390px로 탭 활성 확인.
- **P1 첫방문(Lens2)**: `/user` 콜드 조회 로딩이 텍스트 없는 스켈레톤뿐이라 "멈춤"처럼 보임(안내 문구는 느린 구간 끝난 뒤 등장). `loading.tsx`에 대기 사유 한 줄 + `aria-label`.
- **하드닝(Lens4)**: profile 스냅샷 쿼리에 명시적 `.eq('user_id')` 추가(posts/squads와 동일, RLS 위 방어). 그 외 최근 배치·크래시 경로 전수 재확인 → 회귀 없음.
- 검증: `tsc` 0 · **192 PASS** · build ✓(rival 라우트 등록) · 390px 오버플로 0 · 탭 활성 확인.
- **다음 주 후보**: ①천적 "복수전" CTA를 히어로 근처로 승격(무마이그레이션) ②rate-limit 50k 상한 실제 캡 ③즐겨찾기 구단주 폼 델타 배지.
- ⚠️ **미실행 마이그레이션(운영자, SQL Editor)**: `0017_io_optimization.sql` — 여전히 대기 중(이번 주와 무관).

## 2026-07-31 — [주간 회의] 커뮤니티 유형 발견성 + 폼 추세 스파크라인 + 검색 힌트

- 주간 개선 회의(4렌즈 병렬: 모바일 발견성 / 첫방문 사용성 / 재방문·즐거움 / 정확성). 인프라 소방 몇 주 후 첫 기능 회의.
- **P0 발견성(Lens1)**: `app/community/page.tsx` 유형 필터 칩이 글 5개 미만이면 통째로 숨겨져, 하단탭으로 온 콜드스타트 사용자가 스쿼드 배틀·클럽원 모집 등 7개 유형 존재를 못 봄. 표시 gate 제거 → 칩 상시 렌더(TabChip 44px·scrollbar-hide 재사용). Playwright 390px 확인.
- **P1 재방문(Lens3)**: 폼 추세 스파크라인 — 승률·평점은 이미 `VisitRecorder`가 매일 스냅샷 중이라 **마이그레이션 없이** 구현. `/api/profile` `limit(2)→limit(14)` + `snapshots[]` 추가(delta 하위호환), `lib/form-trend.ts`(순수, risingStreak/isPeak/sparklinePoints) + `app/components/FormSparkline.tsx`(라임 승률·골드 평점 SVG + 🔥연속상승/🏆최고기록 배지) → `/me`. "내가 나아지고 있나?" 훅.
- **첫방문(Lens2)**: 검색창 placeholder에 예시("(예: 밍벨로)") 추가.
- **정확성(Lens4)**: 최근 2주 최적화 배치(slim payload·circuit breaker·picks memo·이미지 TTL·미들웨어 auth 게이트) 전수 감사 → 회귀·크래시 **없음**. slim payload 필드 전수 대조 완결. 유일 지적: `lib/security/rate-limit.ts` 50k 상한이 실제로 캡 안 함(저심각, 5만 distinct IP/60초에서만 CPU 증폭) → 다음 주 후보.
- 검증: `tsc` 0 · **192 PASS**(+17) · build ✓ · 390px 오버플로 0. PR #78
- **다음 주 후보**: ①rate-limit 상한 실제 캡(oldest-resetAt eviction) ②라이벌 H2H 공유 카드(마이그레이션 X) ③FC 스코어 추세(score 컬럼 마이그레이션 필요).
- ⚠️ **미실행 마이그레이션(운영자, SQL Editor)**: `0017_io_optimization.sql`(GIN DROP + ranker 인덱스) — 이번 주 변경과 무관하나 아직 대기 중.

## 2026-07-30 — [서버 CPU/메모리 감사] 이미지 캐시 TTL·picks 메모·rate-limit 상한

- 앱 전체 서버(Vercel 함수) CPU/메모리 2-렌즈 병렬 감사. 결론: **CPU 1위 = `next/og` 이미지 래스터(satori+resvg)**, 메모리 최대 상주 = 선수 인덱스(~12–15MB, spid.json 런타임 fetch·인스턴스 1회 memo). 진짜 누수 없음.
- **적용(PR #76, 동작 보존)**: ① 카드/OG 이미지 캐시 TTL 1h→1일, **매치 카드는 immutable(1년)** — 반복 래스터 대폭↓ ② `loadPicks` 1시간 인스턴스 메모(스냅샷=일 단위, TTL=ISR과 동일 → staleness 0) — squad/meta/report 렌더마다의 300+400×3행 스캔 제거 ③ rate-limit 버킷 Map 5만 상한(다-IP 폭주 방어)
- 검증: `tsc` 0 · **175 PASS**
- **미적용 후보(별도 판단)**: 선수 인덱스 `seasonById` 맵 제거(~3–4MB/인스턴스, 시즌명 온디맨드) · 카드 폰트 번들화(매-렌더 fetch 제거) · squad 카드 element 이중 빌드 1회화 · `toDataUri` 동시성 캡(피크 메모리↓)
- 이미 잘 관리됨(수정 금지): 넥슨 순차 큐(값 미보유)·pause 30s·circuit 스칼라·React cache(요청 스코프)·정적 데이터(수십KB)

## 2026-07-30 — [디스크/WAL 장애 대응] slim payload + circuit breaker + 진단 스크립트

- 웹채팅 장애 핸드오프 이관. 근본원인: Micro(t3a.micro) IO/CPU 버스트 크레딧 고갈 → 체크포인트 지연 → WAL이 8GB 디스크 천장 도달 → 크래시 루프. 자력복구 Healthy. 조치: 컴퓨트 SMALL+ 업그레이드(운영자 대시보드) + 배치 WAL 최적화(코드).
- **§6 감사 결론**: 별도 "수집 배치" 없음 — WAL 생성원은 앱의 `match_cache` jsonb 쓰기(콜드 `/user` 뷰당 최대 30행) + 일일 크론. 나머지는 supabase-js(autocommit)라 idle-in-tx 위험 없음, 전체갱신(TRUNCATE) 패턴 없음.
- **slim payload (PR #74)**: match_cache에 원본 넥슨 match-detail(~30–80KB) 대신 소비자가 실제 읽는 필드만 저장(`lib/nexon/slim.ts`). 필드명·구조 동일 부분집합 → 리더 무변경, 구 데이터 호환. 신규 쓰기부터 적용, 구 행은 retention으로 소멸. 단위테스트 +21(full/slim 집계 출력 동일 검증) → **175 PASS**.
- **circuit breaker (PR #74)**: `lib/supabase/circuit.ts` `guardDb()` — 연속 실패 시 fast-fail로 "재연결 폭풍"(장애 로그 초당 5~10건) 차단, half-open 자동복구. match_cache R/W·service_flags·search_log에 적용.
- **진단 스크립트 (PR #73)**: `scripts/diagnostics.sql` (§8, WAL/디스크/슬롯/idle-tx/vacuum/미사용인덱스/체크포인트).
- **파티셔닝 retention — 채택 안 함(분석 결과 역효과)**: match_cache는 PK가 `match_id`이고 핫 리드가 match_id 단건 조회인데, match_date 레인지 파티셔닝은 파티션 pruning이 안 돼(WHERE에 match_date 없음) 전 파티션 스캔 → **핫 리드 회귀**. 날짜 retention은 이미 #71 DELETE로 성장 억제 중이라 충분. ranker_stats_snapshot도 소형이라 불필요. → **DELETE retention 유지**가 정답.
- **spend cap**: 유지(8GB 천장) + slim payload·retention으로 용량 관리.
- ⚠️ 미적용 SQL: `0017`(GIN DROP + ranker 인덱스) — DB Healthy 후 SQL Editor 실행.

## 2026-07-29 — [IO 전수감사③] 미사용 인덱스 제거 + retention + 커뮤니티 읽기 경량화

- 병렬 3-렌즈 전수 감사(API 라우트 / 서버 페이지 / lib·넥슨 계층). 결론: IO 문제는 seq scan이 아니라 **쓰기 증폭 + 무제한 성장 + 캐시 안 된 per-request 읽기**.
- **정량(콜드 `/user` 1회)**: 넥슨 ~36콜(직렬), Supabase 읽기 ~2, **쓰기 = match_cache 30행 jsonb 배치 upsert(~1–2.5MB)** + search_log 1. 워ム: match_cache 30행 full jsonb 읽기(~1–2.5MB).
- **적용(PR #71)**: ①`match_cache_ouids_idx`(GIN, 미사용) DROP → 30-insert마다의 쓰기 증폭 제거(최대 단일 이득) ②`ranker_stats_snapshot(match_type,snapshot_date)` 인덱스 추가 → 스쿼드뷰 seq scan 제거 ③크론 retention(match_cache 90d/snapshot 60d) → 무한 증가·500MB 한도 방지 ④커뮤니티 목록 `count:exact→estimated`·`getPost` React.cache dedupe·배틀 GET head카운트+10s edge캐시
- ⚠️ **0017 마이그레이션은 SQL Editor 실행 필요**(GIN DROP이 쓰기-IO 핵심)
- 검증: `tsc` 0 · **154 PASS**
- **업그레이드 판단**: 지속 IO 드레인 1·2위(미들웨어 auth #67, search_log 봇 #69)+이번 쓰기증폭/성장 원인이 대부분 코드/스키마발 → **먼저 무료 유지하고 배포+0017 후 IO 관측**. 이후에도 baseline 초과하거나 DB가 500MB 근접하면 **Pro($25/mo, 8GB·no-pause·Micro 컴퓨트)** 로. 남은 후보: match/[matchId] ISR, match_cache slim payload(projection), 커뮤니티 write precheck/RLS 중복 제거

## 2026-07-29 — [IO 점검②] search_log 봇 쓰기 제외 + 코드 IO 감사

- **search_log 쓰기 절감**: `/user/[nickname]`(동적 SSR)이 성공 렌더마다 `logNicknameSearch` upsert. 크롤러가 sitemap의 `/user/*`를 재크롤하며 유발하던 무의미한 쓰기 → 봇 UA 정규식으로 제외. 사람 검색만 시드 유지. PR #69
- **코드 IO 감사(운영자 Query Performance 교차확인용)**: ①미들웨어 auth(최대 지속 드레인)=#67 해결 ②search_log=#69 해결 ③`match_cache` R/W: 읽기 인덱스 정상·쓰기는 미스에만(필요)이나 **payload jsonb 무기한 보관→테이블 무한증가**가 장기 IO 부담(보관기간 정리 검토 여지) ④일일 크론 ranker-snapshot=일1회 버스트(지속 아님) ⑤`/`,`/meta`,`/player`,`/report/weekly`=ISR `revalidate=3600`로 매요청 DB 안침
- 검증: `tsc` 0 · **154 PASS**

## 2026-07-29 — [장애·후속] Disk IO 부하 감소 — 비로그인 요청 auth 왕복 제거

- **실제 근본 원인 확인**: Supabase는 일시정지가 아니라 **NANO 인스턴스가 Disk IO Budget 소진** → DB 스로틀링 → `getUser()` 지연 → 미들웨어 504. (일시정지 가설 정정)
- **수정**: 미들웨어가 매 요청 `supabase.auth.getUser()`(auth=DB 왕복)를 호출하던 것을, `sb-*-auth-token` 세션 쿠키가 있을 때만 호출하도록 게이트. 비로그인·크롤러(트래픽 대부분)는 왕복 skip → NANO Disk IO 주요 소모원 제거. 동작 불변(세션 없으면 어차피 유저 없음). PR #67
- 검증: `tsc` 0 · **154 PASS**
- **⚠️ 운영자 조치(P0, 계정)**: ① 배포 후 Supabase Reports→Database에서 IO 회복 확인 ② AI Assistant/Query Performance로 비싼 쿼리 점검 ③ 트래픽이 실제로 크면 컴퓨트 NANO→Micro/Small 업그레이드 검토

## 2026-07-29 — [장애] 미들웨어 Supabase auth 504 방어 (사이트 전체 다운)

- **증상**: 프로덕션 `504 GATEWAY_TIMEOUT` / `MIDDLEWARE_INVOCATION_TIMEOUT` → 사이트 접속·로그인 모두 실패. 코드는 2일간 무변경 → 런타임(Supabase 도달 불가) 원인
- **근본 원인**: `lib/supabase/middleware.ts`가 거의 모든 경로에서 `await supabase.auth.getUser()`를 timeout·catch 없이 호출. Supabase Auth 불통 시(무료 플랜 자동 일시정지 등) 미들웨어 한도까지 매달려 전 경로 504 — 비로그인 전적 검색·진단까지 다운
- **수정**: `getUser()`를 3초 `Promise.race` timeout + try/catch로 감쌈. 세션 갱신 best-effort화 → 인증 불통이면 로그아웃 상태로 정상 진행, 사이트는 생존. Supabase 정상 시 동작 불변
- 검증: `tsc` 0 · **154 PASS**. (샌드박스 build 실패는 차단된 Google Fonts fetch 뿐 — 본 변경 무관). PR #65
- **⚠️ 운영자 조치(P0, 계정)**: 로그인 자체 복구는 Supabase 프로젝트 정상화 필요 — 대시보드에서 일시정지면 **Restore**, 아니면 프로젝트 장애/키 확인

## 2026-07-27 — [주간 회의] 메타 리포트 발견성 + FC Scope 스코어 설명 + 클리닉 모순 수정

- 주간 개선 회의(4렌즈 수렴): 발견성·명료성·정확성 3건 묶음
- **발견성(Lens1)**: `/report/weekly`가 `/meta` 인라인 링크 하나로만 도달 → 홈 FEATURES에 메타 리포트 카드 추가 + `/meta` 링크를 44px 블록으로 승격 + 홈 FEATURES를 유튜브 스트립 위로 재배치 + 즐겨찾기 칩 44px
- **명료성(Lens2)**: FC Scope 스코어 설명 캡션(승패·득실차·평점·점유율 종합 10점) + 실사용 평점 스케일(인게임 평점 출전수 가중, 10점) 명시
- **정확성(Lens4, CONFIRMED)**: `SquadSection`이 `diagnoseSquad`에 ranker-stats의 없는 필드 `spRating` 조회를 넘겨 항상 undefined → 클리닉이 매번 "랭커 비교 데이터 적음" 경고, 아래 카드는 실제 랭커 비교 표시하던 모순 제거. 죽은 조회 제거 + coverage 0(설계상)일 때 경고 억제(부분 매칭 시엔 유지)
- 검증: `tsc` 0·**154 PASS**·build ✓·Playwright 390px home/meta/report 오버플로 0. PR #64
- 다음 주 후보: FC 스코어 추세 그래프(재방문 훅) — `user_snapshots`에 score 컬럼 마이그레이션 필요

## 2026-07-24 — [성장] 주간 메타 리포트 + GA4 측정

- 트래픽 성장 착수(수익화 전제).
- **② `/report/weekly`**: 상시 SEO 콘텐츠 — 이번 주 급상승·신규 + 라인별 대세 TOP5(일일 스냅샷). ISR 1h, Article JSON-LD, canonical/OG, sitemap 등재, /meta 링크. `topMovers()` 헬퍼
- **P1 GA4**: `NEXT_PUBLIC_GA_ID` env-gated gtag(next/script). 미설정 시 미렌더(확인). 검색어·퍼널 측정용
- `/user` 속도: 안전 개선(병렬 fetch) 기반영, 심화 LCP는 프로덕션 프로파일링 필요로 보류
- 검증: `tsc` 0·**154 PASS**·build ✓·/report/weekly 200·390px 오버플로 0. PR #63
- **사용자 조치(P0, 계정)**: 0016 실행 · Search Console/네이버 등록+sitemap 제출 · (원하면)`NEXT_PUBLIC_GA_ID` 설정 · 넥슨 키 재발급

## 2026-07-24 — [기능] 내 카드 vs 랭커 실스탯 비교 + 플레이스타일 배지

- ranker-stats 문서 확정 필드로 신규 기능(①④). 
- **① 내 카드 vs 랭커**: 선수 성적표에서 내 카드 경기당 골·패스% vs 같은 카드×포지션 랭커 평균 비교(내 값 우위면 초록). 기존 spRating 의존 평점 막대 제거
- **④ 플레이스타일 배지**: `lib/nexon/playstyle.ts`(순수) 결정력/개인기/연계/수비형 → 도감 포지션별 카드
- ② 도감 스탯 정정은 PR #61 반영 / ③ 포지션별은 기존 PositionCard가 제공(배지로 강화)
- 검증: `tsc` 0·**154 PASS**(+6)·build ✓. PR #62

## 2026-07-24 — [정합성] ranker-stats 실제 스펙 정합 (spRating/intercept 없음)

- 공식 ranker-stats 스키마 확인: status는 경기당 평균 고정 필드 집합, **spRating·intercept 없음**. 앱이 둘을 읽어 가짜 "평점 0.00" 표시 + 골 이중평균(goal/matchCount) 하던 것 수정
- picks.ts: spRating 제거, goalsPerMatch=status.goal(이미 경기당 평균), passPct 추가
- /meta·/player·RankerStatPanel·ranker-stat API: 평점 제거→경기당 득점/패스%/랭커 N경기, 태클·인터셉트→태클·블락
- ⚠️ match-detail의 player.status.spRating(경기 개인평점)은 정상 존재 → 전적/성적표/POTM은 그대로
- SquadSection 랭커 평점 벤치마크는 undefined로 자연 숨김 → 실스탯 비교로 후속 대체
- 검증: `tsc` 0·**148 PASS**·build ✓. PR #61

## 2026-07-24 — [홈 배치] 데일리 대시보드 리듬 정리

- 홈에 쌓인 데일리 섹션(급상승·영상 2종·기능)을 하나의 대시보드로 정리
- 데스크톱 히어로 과여백 축소(sm:pt/pb-24 → pt-16/pb-14) → 신선 콘텐츠 상단 이동
- 섹션 간격을 래퍼가 아닌 콘텐츠 요소(mt-6/mt-8)에 부여 → 자체 미표시 시 빈 여백 0
- 검증: `tsc` 0·**148 PASS**·build ✓·Playwright 390/1280px 오버플로 0. PR #60

## 2026-07-24 — [콘텐츠 피드] 홈 유튜브 영상 스트립 (FC온라인 + 축구)

- **목표**: 매일 새 영상 = "오늘 뭐 올라왔나" 데일리 방문 훅. API 키·비용 0(채널 RSS)
- **레이아웃**: 🎮 FC온라인 인기 영상 / ⚽ 축구 소식 — 두 라벨 가로 스크롤 스트립을 세로로 나란히(탭으로 숨기지 않고 동시 노출). 카드=16:9 썸네일+제목(2줄)+채널·상대시간, 탭 시 유튜브 새 탭
- **`lib/youtube/channels.ts`**: 그룹별 큐레이션 화이트리스트(교차확인 ID). 틀린 ID는 빈 피드로 조용히 제외
- **`lib/youtube/feed.ts`**: RSS fetch(키 0)·6시간 캐시·최신순 병합. `parseFeed()` 순수 함수(엔티티 디코드/채널당 컷/URL/깨진 입력 안전)
- **`YoutubeStrip`**(서버): plain img(도메인 설정 불필요), 영상 없으면 미표시. 홈 '오늘의 급상승' 아래
- 검증: `tsc` 0·**148 PASS**(+8 파서)·build ✓·홈 390px 오버플로 0. PR #59
- **⚠️ 사용자 확인**: 개발 샌드박스가 youtube.com 차단(403) → 여기선 빈 스트립. 프로덕션에서 노출되며 채널ID는 교차확인(RSS 미검증)이라 배포 후 각 채널 표시 확인 권장, 안 뜨면 channels.ts에서 교체

## 2026-07-24 — [습관화 보완] /me 워치리스트 + FavoriteButton 방어

- 자가점검(tsc·단위 140·build·smoke 20·Playwright 통과) 후 약점 2건 보완
- **/me 즐겨찾기 워치리스트**: 마이페이지에 즐겨찾기 목록 + 항목별 제거(✕) + 방문 스트릭. 홈 대시보드가 보기 전용이라 제거 경로가 없던 문제 해소. `getStreak()`(표시 전용)로 방문 이중 카운트 방지
- **FavoriteButton `disabled={!ready}`**: 하이드레이션 전 오토글 방지
- PR #58

## 2026-07-24 — [습관화] 홈 데일리 대시보드 + 방문 스트릭 + 즐겨찾기

- **목표**: "자주 들어오고 싶은 사이트". 전부 localStorage 기반(로그인·마이그레이션·인프라 0)
- **① 홈 데일리 대시보드**: `TodayMover`(서버) ⚡오늘의 급상승을 홈 첫 화면에, 홈 ISR(revalidate 3600) 전환. 스냅샷 없으면 미표시
- **② 방문 스트릭**: `HomeDashboard`(클라)가 방문 기록 → "N일 연속 방문 중"(최고 유지, 하루 1회). 신규 방문자엔 미표시
- **③ 즐겨찾기 워치리스트**: 전적 히어로 ☆/★ 토글(`FavoriteButton`) + 홈 대시보드 즐겨찾기 칩(원탭 재방문). 대소문자 dedup·최대 20
- **리팩터**: `pickTopMover`/`LINE_TITLE` → `lib/meta/picks.ts` 공용화
- 검증: `tsc` 0·**140 PASS**·build ✓·Playwright 390px(스트릭·즐겨찾기 렌더+오버플로 0). PR #57
- **미완(분리)**: ③의 웹푸시 능동 알림은 VAPID 시크릿 + 발송 크론 필요 → 별도 단계

## 2026-07-24 — [성장 1순위] FC Scope 스코어 (자체 경기 퍼포먼스 점수 0~10)

- **배경**: 방문 빈도(습관)의 핵심 = 정체성 + 매 세션 재확인 훅. op.gg OP Score / fut.gg GGR 대응을 넥슨 경기 데이터만으로(유료 시세·OVR 불필요) 구현
- **`lib/nexon/score.ts`**(순수·단위테스트): `matchScore`(결과+득실차+인게임평점+점유율→0~10, 몰수 고정) · `recentScore`(최근 평균) · `scoreTier`(월드클래스 gold/수준급 win/평범 muted/분발 lose)
- **전적 폼 전광판**: FC Scope 스코어를 승률 앞 대표 지표로(점수+등급 라벨+색)
- **경기 행**: 경기별 스코어 칩 모바일에서도 항상 노출("리포트 →"는 모바일 숨김으로 자리 확보)
- **전적 공유 카드**(`/api/card/user`): `FC 스코어` 대표 배지(등급색) → 공유 자산과 결합
- 검증: `tsc` 0 · build ✓ · 단위 **140 PASS**(+12). PR #56. 마이그레이션 없음

## 2026-07-24 — [도메인] fcscope.xyz 커스텀 도메인 전환 + 검색엔진 준비

- **도메인**: Vercel primary = `www.fcscope.xyz` (apex `fcscope.xyz` → 308 → www). 가비아 구매, Vercel A(`216.198.79.1`) + www CNAME 연결·SSL 발급 완료
- **`lib/site.ts`**: 기본 `SITE_URL` 을 구 프리뷰 호스트 → `https://www.fcscope.xyz`. sitemap/robots/canonical/OG 전부 이 단일 소스에서 파생 → 새 도메인 자동 반영
- **`app/layout.tsx`**: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` env 기반 소유확인 meta 태그(미설정 시 미출력) + canonical alternate 명시
- **`.env.example`** 신규(gitignore allow-list) — 도메인·검증·기존 env 문서화
- 검증: `tsc` 0 · build ✓ · robots.txt/ sitemap.xml 가 www.fcscope.xyz 로 출력 확인
- **⚠️ 사용자 조치**: ① Vercel `NEXT_PUBLIC_SITE_URL=https://www.fcscope.xyz` 설정 후 재배포 ② Google Search Console/네이버 서치어드바이저 소유확인 + sitemap 제출 ③ Supabase Auth URL Configuration(Site URL + Redirect URLs)에 새 도메인 추가

## 2026-07-21 — [op.gg 벤치마킹 Phase 2] 전적 갱신 + 콜드 로드 속도

- **전적 갱신 버튼**(op.gg 시그니처): `POST /api/refresh/[nickname]` → `revalidatePath`로 전적·이적시장 캐시 만료 → 다음 렌더에서 변하는 데이터만 넥슨 최신 조회(불변 매치 상세는 영구 캐시 유지). 남용 방지: 프로필당 20초 1회 + IP당 분당 15회(429). RefreshButton 히어로 배치(갱신 중…/갱신됨/잠시 후 다시, 44px)
- **속도**: `getUserBasic`+`getMaxDivisions` Promise.all 병렬화 → 콜드 프로필 직렬 왕복 1회 절감
- 검증: `tsc` 0·**128 PASS**·build ✓·라우트 스모크(POST 200 → 즉시 429 → GET 405). PR #53
- 마이그레이션/환경변수 변경 없음

## 2026-07-21 — [op.gg 벤치마킹 Phase 1] 검색 유입 엔진 (SEO 색인)

- **배경**: op.gg 성장의 핵심 = 프로필/엔티티 페이지 검색 색인. 기존 sitemap이 최대 SEO 자산(선수 도감·구단주 프로필)을 누락하고 있었음
- **sitemap 확장**: `/player/[spid]`(실선수 대표 카드, thin 중복 방지) + `/user/[nickname]`(검색된 구단주). try/catch graceful
- **search_log (마이그레이션 0016)**: 검색 닉네임 기록(service_role 전용, RLS on·정책 없음). `logNicknameSearch()` fire-and-forget, 테이블 미생성 시 무시
- **JSON-LD**: 홈 `WebSite`+`SearchAction`(구글 sitelinks 검색창), /player `BreadcrumbList`, /user `ProfilePage`+`BreadcrumbList`
- **⚠️ 사용자 조치**: `supabase/migrations/0016_search_log.sql` 실행 필요(미실행 시 /user 색인만 비활성, 나머지 즉시 동작). 아울러 Google Search Console 도메인 등록 권장(색인 측정)
- 검증: `tsc` 0·**128 PASS**·build ✓·/sitemap.xml 200·홈 SearchAction 노출. PR #52

## 2026-07-21 — [7일 프로그램 종료] 정합성 수정 + 최종 요약

- **마지막 회의**: 새 위험 없이 안정화. `pickTopMover`가 각 라인 전체(최대 400)에서 급상승을 뽑아 11위+ 카드가 헤드라인에 뜨는데 목록엔 없던 불일치 → 후보를 노출 목록과 동일한 상위 10위로 제한. `tsc` 0·**128 PASS**·build ✓. PR #51
- **7일 프로그램(07-14~07-21) 종합**:
  - Day1~2: 계급 인증 공유 카드 (디시 계급 인증글 포맷, 추가 호출 0)
  - Day3: 발견성 대청소 — 계급 카드 히어로 승격, 이적시장 버튼 un-clip, 홈 라벨, 빈검색 피드백, safeDecode, summarizeMatch 관점 오염 방지
  - Day4: /me 모바일 탭 노출(숨은 리텐션 페이지), 오늘의 급상승 헤드라인, 이적시장 배지 오답 방지
  - Day5: 선수 도감 발견성(홈 노출+연속탐색+데스크톱 nav), 스쿼드 빠른시작 라벨, 천적/호구 배지
  - Day6: flagship "내 픽 vs 랭커 픽"(성적표 헤드라인+배지), 스쿼드 복제 편집
  - Day6.5: 모바일 밀도 정리 3라운드(여백·줄바꿈·장황 문구)
  - Day7: 랭커 대세픽 챌린지 공유 카드(바이럴 루프 완성), 배틀 A/B 모바일 2열, 비로그인 글쓰기 안내
  - Day8: 급상승 정합성 마무리
  - 관통 원칙: "좋은 기능을 숨기는 게 최악" — 발견성·쉬운 사용·정직한 데이터 표현. 단위 테스트 121→128, 마이그레이션 0건, 회귀 0.

## 2026-07-20 — [데일리 회의 Day 7] 랭커 대세픽 챌린지 공유 카드 (바이럴 루프)

- **회의**: 카드 구현계획 + 모바일 회귀 스윕 + 정확성 사전점검 3-렌즈. 프로그램 마지막 콘텐츠 데이
- **[flagship] `/api/card/pickmatch/[nickname]` 챌린지 공유 카드**(9:16): "내 스쿼드 랭커 대세픽 N명 · 너는 몇 명?" → 보는 사람을 본인 검색으로 유도(공유 카드가 "인증"만 있고 "비교/챌린지"가 0이던 갭 해소)
  - N을 SquadSection과 동일 로직으로 재계산(`loadPicks(mt,false)`+`topPickIdsByLine(10)`+`isTopPick` spId×라인, games≥2·top18) → 카드 숫자=페이지 숫자, `?mt=`로 탭 일치
  - user 카드와 동일 rate-limit(`limitNexonFanout 'card'`)+`nodejs`/`maxDuration=60`, 잘못된 닉/스냅샷·스쿼드 없음은 404(빈·0명 PNG 배포 안 함)
  - 성적표 "내 픽 vs 랭커 픽" 헤드라인 아래 🔥 버튼(`hasPickData`일 때만)
- **[발견성] 스쿼드 배틀 A/B 나란히(모바일 2열)**: 세로로 쌓여 투표가 ~950px 아래로 밀리던 것 → 투표 즉시 도달
- **[편의] 비로그인 글쓰기 안내**: 무설명 리다이렉트 → `reason=write` + 로그인 화면 "글을 쓰려면 로그인이 필요해요"
- **[모바일] AuthButton 댓글 알림 링크 44px**
- 회귀 확인: 어제 밀도 정리(PR #49) 회귀 0(7화면 오버플로 0·탭바 가림 없음). 검증 `tsc` 0·**128 PASS**·build ✓·Playwright 390px 오버플로 0. PR #50

## 2026-07-19 — 모바일 UI 밀도 정리 (3라운드, 사용자 요청)

- 낭비 세로 공백·의미없는 줄바꿈·장황한 문구를 모바일 390px 최우선으로 정리. 동작 변경 없음(레이아웃만)
- **R1 홈**: 히어로 pt/pb-16→10/8, 검색 mt-8→5, 기능 pb-24→12, H1 모바일 `<br>` 제거(한 줄) → 첫 화면에 기능 카드가 폴드까지 노출
- **R2 전적·픽랭킹**: 매치탭 mt-6→4, 하단 공유 mt-8→6, 빈상태 py-14→10, 에러/rate py-24→16 / 픽랭킹 라인 space-y-6→4, 빈상태 py-16→10, 2줄 캡션→1줄
- **R3 나머지**: 스쿼드 부제·빠른시작 헬퍼 축약 + 드래그 안내 모바일 숨김, 커뮤니티 pb-28→24·pt-6→4, /me 패널 p-5→p-4 sm:p-5, 선수도감 캡션 3줄→1줄·py-12→10, 이적시장 에러 py-24→16
- 검증: `tsc` 0, build ✓, 단위 **128 PASS**, Playwright 390px 5개 화면 오버플로 0 + 홈 밀도 개선 확인. PR #49

## 2026-07-19 — [데일리 회의 Day 6] flagship "내 픽 vs 랭커 픽"

- **회의**: 구현계획 + 발견성 스윕 + 정확성 사전점검 3-렌즈. 2일 연속 ROI 1위였던 flagship 구현
- **[flagship] 선수 성적표에 "내 픽 vs 랭커 픽" 헤드라인**: 내가 실제 기용한 카드 중 오늘의 랭커 인기 TOP10과 겹치는 수를 라인별 대조. 매일 갱신 스냅샷 → 재방문 훅. 겹치는 카드엔 🔥 대세픽 배지
- **정확성 사전점검 반영(정직성)**:
  * 대조 = spId × **라인** (정확 포지션 코드 아님 — ST=24/25/26 별칭 거짓 미포함 방지)
  * **"히든픽" 희소성 주장 제거** — 스냅샷이 매치유형당 ~60조합만 워밍해 "안 겹침=랭커 안 씀" 근거 부족. 고정밀 overlap만("랭커 대세픽 N / TOP10 외 M")
  * 스냅샷 워밍 매치유형은 50·52뿐 → 그 외/콜드스타트/getAdmin null/0경기 전부 헤드라인 숨김·크래시 없음
- **리팩터**: /meta 랭커 픽 로직 → `lib/meta/picks.ts` 추출(`loadPicks(matchType, withDelta)` + `topPickIdsByLine`/`isTopPick`). /meta 동작 불변(정적·delta·급상승 배너 회귀 없음 확인)
- **[발견성] /squad/[id] "이 스쿼드 복제해서 편집"**: 공유 유입 뷰어가 빈 빌더로 가던 dead-end 해소(`?load=` 재사용, GET 공개 확인)
- **[발견성] /me 최근검색 칩 + 내가 쓴 글 행 44px**: Day4/5에서 놓친 /me 내부 터치 타깃
- 검증: `tsc` 0 err, build ✓(/meta static 유지), 단위 **128 PASS**(+6 spId×라인 대조 잠금), Playwright 390px /meta 200·헤딩·오버플로 0. PR #48

## 2026-07-18 — [데일리 회의 Day 5] 선수 도감 발견성 + 온보딩 + 천적/호구

- **회의**: 비판적 4-렌즈 병렬. 수렴 주제 = 선수 도감(/player) 발견성 + 연속 탐색 dead-end
- **[발견성 P0] 홈 픽 랭킹 카드에 "선수 이름 도감 검색" 노출**: /player가 픽 랭킹 탭 깊숙한 검색창에만 있어 숨은 기능이던 것 → 홈에서 인지
- **[발견성 P0] /player 상세에 PlayerSearch 임베드**: 도감 한 명 본 뒤 다음 선수 보려면 /meta로 돌아가야 하던 dead-end → 인라인 연속 탐색
- **[발견성 P0] 데스크톱 nav에 "내 정보"(/me)**: 모바일은 Day4 탭 확보했으나 데스크톱 비로그인은 기기 기반 내 스쿼드·최근 검색 접근 경로가 없었음
- **[온보딩 P1] 스쿼드 빌더 "⚡ 빠른 시작" 헤딩**: 프리셋·내 스쿼드 불러오기가 라벨 없이 정체불명 폼으로 보이던 것(2일 연속 후보) → 명시적 헤딩
- **[온보딩 P1] 전적 빈 상태 안내**: 각 매치 유형 빈 화면에 "다른 매치 유형 탭 확인" 유도 + 톤 "~어요" 통일(선수 성적표 격식체 정정)
- **[재미] RivalsPanel 천적/호구 배지**: 이미 집계된 승/패로 3경기+·2경기차+ 시 천적(열세)/호구(우세) 라벨. 감정형 H2H 훅, 추가 데이터 0
- 검증: `tsc` 0 err, build ✓, 단위 **122 PASS**, Playwright 390px 홈·스쿼드·/player 오버플로 0 + 빠른시작 헤딩 + /player 선수검색창 + 데스크톱 nav "내 정보" 확인. PR #47
- 정확성 리뷰(Lens4): Day4 급상승/탭/배지 회귀 0 확인. cosmetic 1건(급상승 배너가 top10 밖 카드 뽑을 수 있음) — backlog

## 2026-07-17 — [데일리 회의 Day 4] 숨은 마이페이지 노출 + 오늘의 급상승 픽

- **회의**: 비판적 4-렌즈 병렬 회의. 발견성 최우선 원칙 유지
- **[발견성 P0] /me를 모바일 하단탭 5번째 "내 정보"로 노출**: /me는 로그인 없이도 기기 기반 재방문 훅(내 스쿼드·최근 검색·지난 방문 delta)을 보여주지만 하단탭·헤더 어디에도 진입점이 없어 모바일에서 리텐션 페이지 통째로 도달 불가였음. `match`는 `/meta` 충돌 방지 정확 일치(`p === "/me"`)
- **[재미 P1 · flagship] /meta "⚡ 오늘의 급상승" 헤드라인 배너**: `loadPicks()`가 이미 계산하는 일일 순위 delta 재활용(추가 넥슨 호출 0·신규 테이블 0). 상승폭 최대, 없으면 오늘 NEW 진입 최다 사용 카드. 매일 바뀌는 데이터를 "사건"으로 → 재방문 훅. `pickTopMover()` 순수 함수
- **[정확성] HeroBadges 이적시장 배지**: buy/sell 중 하나만 실패(429)해도 zeros로 진단해 "무지출 셀러" 같은 확신에 찬 오답 라벨이 뜨던 것 → 두 피드 모두 있을 때만 진단(`buy && sell`)
- **[모바일 P1] 터치 타깃 44px**: 매치종류 탭 · 뷰 서브탭 · 커뮤니티 필터칩
- **[편의] 전적 뷰 서브탭 "분석" → "종합 리포트"** (선수 성적표·플레이스타일과 구분)
- **[정리] dead code**: 조/경 기준 이관 후 미사용 `EOK` 상수 삭제
- 검증: `tsc` 0 err, build ✓, 단위 **122 PASS**, Playwright 390px 홈·/me·커뮤니티·/meta 가로 오버플로 0 + 하단탭 5개 + /me 비로그인 렌더 확인. PR #46

## 2026-07-16 — 성향 배지 설명 노출 + "강화러" 라벨 정정

- **배지에 설명(왜 이 유형인지) 표시**: 히어로 우측 코너 칩(hover 툴팁만) → 히어로 아래 전체폭 카드 2장(유형 칩 + 한 줄 설명). 모바일에서 툴팁이 안 뜨던 문제 해소, 탭하면 상세 진단으로 이동
- **"꾸준한 강화러" → "완성형 선호"**: grade는 *구매한 카드*의 강화 수치라 8강+ 완성품을 산 것을 본인이 강화한 것처럼 오인하던 라벨 정정. desc도 "직접 강화 대신 시장 완성품을 사는 타입"으로 명확화
- 같은 오인 제거: n-grade-low "직접 키우는 재미파"→"낮은 강화 카드 위주로 담습니다", n-maxgrade-1only "강화는 내 손으로"→"완성품 대신 원카만 담습니다"
- 단위 122 PASS, 390px 렌더 확인. PR #45

## 2026-07-16 — 이적시장 진단 금액 기준 상향 (요즘 시세 반영)

- 총액 스케일 ×10,000 (억→조, 조→경) — "화끈한 큰손"/"흑자 큰손" 기준을 1조 → **1경**으로 (상위 카드 단건이 수십~수백조인 현 시세 반영)
- 총지출/총수입/순수지 tier 전부 조·경 단위로 이동
- 단건 카드 기준(최고가·평균가)은 관측 분포(단건 최대 ~370조)에 맞춰 별도 튜닝 — 최고가 대형 50~200조/슈퍼스타 200조+, 평균 명품관 50조+, 하이롤러 avg 80조+ (죽은 룰 방지)
- GYEONG(1e16) 상수 추가. 단위 테스트 갱신(+1: 5000조는 큰손 미달 회귀 방지) = 122 PASS
- 실측: 8,240조=수집가, 1.2경=화끈한 큰손 확인. PR #44

## 2026-07-16 — [데일리 회의 Day 3] 발견성 대청소 + 안전 수정

- **회의**: 비판적 4-렌즈 병렬 회의(모바일UX/발견성 · 첫방문 편의 · 재방문/재미 · 정확성). 최우선 원칙 "좋은 기능을 숨기는 게 최악"에 따라 발견성 중심으로 P0 선정
- **[발견성 P0] 계급 인증 카드 CTA를 히어로로 승격**: 어제 만든 flagship 공유 카드가 전적 페이지 최하단(모바일 ~3000px 스크롤 뒤)에 묻혀 있던 자기모순 해소 → 등급 표시 바로 아래로 이동. 하단엔 전적 카드만 유지
- **[발견성 P0] 이적시장 버튼 un-clip**: `ml-auto` 제거 → 좁은 화면 스크롤 컨테이너 밖으로 밀려 잘리던 문제 해소
- **[발견성 P0] 홈 스쿼드 배틀 카드 딥링크**: `/community` → `/community?type=squad_battle`
- **[편의 P1] 홈 카테고리 라벨 모바일 노출**: `hidden sm:block`이라 모바일에서 안 보이던 라벨 노출 + 서브라인을 구체 문구("FC온라인 전적·스쿼드·랭커 메타를 한 곳에")로 강화 (첫 3초 인지)
- **[편의 P1] 빈 검색 피드백**: 빈 값 제출 무반응 → 포커스 + 인라인 안내 + 입력창 강조
- **[모바일 P1] 터치 타깃**: ShareCardButton / 최근 검색 칩 44px↑
- **[정확성] safeDecode**: 잘못된 % 닉네임이 `decodeURIComponent` throw로 generic 에러에 떨어지던 것 → not-found 자연 처리 (계급 카드 라우트와 일관)
- **[정확성] summarizeMatch 관점 오염 방지**: 요청 ouid가 matchInfo에 없을 때 상대를 '나'로 착각해 승패·평점·스냅샷이 조용히 반전되던 것 → 해당 경기 drop
- 검증: `tsc` 0 err, build ✓, 단위 **121 PASS**, Playwright 390px 홈 가로 오버플로 0 + 라벨/서브라인 렌더 확인, `/community?type=squad_battle` 200. PR #43

## 2026-07-16 — [데일리 회의 Day 2] 계급 인증 카드 (숨긴 자산 승격)

- **회의 결론**: 오픈 초기 발견성·바이럴 관점에서 "이미 뽑아둔 maxdivision을 공유 자산으로 승격"이 최고 ROI. 넥슨 추가 호출 0회(전적 페이지에서 이미 조회 중), 디시 '계급 인증글' 포맷과 정확히 맞음
- **`/api/card/rank/[nickname]`** 신설: 대표 계급(공식경기 50 우선, 없으면 최상위 division) 주역 + 다른 매치 종류를 배지로. 티어색 `divisionTierColor()`(≤1300 챌린지↑=gold / ≤2200 월드클래스=lime / 프로↓=muted, 순수 함수·API 미사용)로 등급별 스탬프 색 분기. 9:16 1080×1920 `renderCard` 재사용. 렌더 실측 정상(113KB PNG)
- **전적 페이지 하단 공유 줄**에 `🏆 계급 인증 카드` 버튼 추가(전적 카드 옆, `divisionCards>0`일 때만). origin/main이 히어로에서 이미 등급을 DivisionIcon+골드로 승격해둔 상태라 히어로 중복 엠블럼은 넣지 않고 공유 버튼만 추가
- 리베이스로 origin/main(HeroBadges·DivisionIcon·/market 분리·페이지 rate limit) 위에 재정렬. `npx tsc` 0 err, build ✓, 단위 **121 PASS**. PR #42

## 2026-07-15 — 정식 오픈: BETA 배지 제거

- 로고 옆·스쿼드 클리닉·플레이스타일 3곳의 "BETA" 배지 제거 (정식 서비스 오픈). PR #40

## 2026-07-15 — 오픈 전 보안 하드닝 (감사 지적 4건)

- **넥슨 팬아웃 IP rate limit 확대**: 기존 from-user만 → `/user` SSR(user-page)·`/market` SSR(market-page)·`/api/card/user`(card)·OG 이미지(og, 분당 60 관대 + 한도 초과 시 닉네임 폴백 카드로 썸네일 깨짐 방지)·`/api/players/ranker-stat`·`/api/profile/verify` 전부 적용. 페이지는 "지금 조회 요청이 많아요" 안내 렌더, API는 429+Retry-After
- **배틀 투표 조작 방지**: voter를 서버 파생으로 변경 — 로그인=계정 해시(1인 1표), 익명=IP해시+기기id 해시(기기id 갈아끼우기 무력화) + IP당 분당 15회. 클라이언트 변경 불필요("로그인 불필요" 유지)
- **보안 헤더 5종**(next.config.ts): HSTS/X-Frame-Options(SAMEORIGIN)/CT-Options/Referrer/Permissions
- **XFF 위조 방지**: `clientIpFrom`을 x-real-ip 우선으로 통일(스쿼드 일일 저장 한도 우회 차단)
- dev 실측: 헤더 5종 응답 확인, /user 41번째 요청부터 차단 확인. 단위 **121 PASS**. PR #39
- 감사 결과 요약: 치명/높음 코드 이슈는 위 rate limit이 유일했고 시크릿/인가/injection/SSRF는 이상 없음. 남은 낮음(조용한 실패 6건, global-error 부재)은 오픈 후 처리

## 2026-07-15 — 탭바 검색 진입 + 스쿼드 저장 게이팅 + 마이페이지 스쿼드 관리

- **모바일 탭바**: 내 정보 제거(AuthButton 메뉴로 충분), 맨 왼쪽에 **전적 검색** 탭(/?focus=1 → 히어로 검색 자동 포커스, SearchForm 기존 지원 활용)
- **스쿼드 빌더 저장**: "저장 (N/11)" → "저장", **11명 모두 배치 시에만 활성화** + 안내 문구
- **마이페이지 스쿼드 관리**: 행마다 수정(/squad?load=id — 빌더로 불러와 편집, 저장 시 새 스쿼드)·삭제 버튼. `GET/DELETE /api/squad/[id]` 신설(DELETE는 로그인+본인 user_id 소유만, 로컬 전용 스쿼드는 기기 목록에서만 제거). `forgetMySquad` 추가
- SquadBuilder useSearchParams 도입 → /squad Suspense wrap
- Playwright 390px 검증(포커스·비활성 저장·관리 행·오버플로 0), 단위 120 PASS. PR #38

## 2026-07-15 — 등급 아이콘 위치 수정 (매핑 반전 롤백)

- 아이콘 인덱스 매핑을 원복(슈퍼챔피언스=0 내림차순) — 이전 반전은 오해석이었음
- 사용자가 말한 "위치"는 레이아웃: 아이콘을 매치종류명 앞 → **등급명 바로 왼쪽**으로 이동 (인게임 표기와 동일). PR #37

## 2026-07-15 — 핫픽스: 거래 목록 헤더 한 줄 + 등급 아이콘 인덱스 반전

- 영입/방출 제목 세로 깨짐: `.input-search`(width:100%) 셀렉트가 제목을 밀어냄 → 자체 스타일 셀렉트 + 제목 nowrap. 390px 검증
- `ico_rank` 인덱스 오름차순(유망주3=0→슈퍼챔피언스=17)으로 반전 — 실등급과 불일치 리포트 반영. ⚠️ CDN 미검증 환경이라 재불일치 시 사용자 확인 필요. PR #35

## 2026-07-15 — 모바일 히어로/탭 UX 개선 + 등급 아이콘

- **히어로 재배치**: 좌측 닉네임·레벨 + 등급(세로 스택), 우측 성향 배지 **세로 2줄**(공백 활용). 모바일 h1 text-2xl, 달성일은 sm 이상에서만 표시, 등급 토큰 whitespace-nowrap(어색한 중간 줄바꿈 제거)
- **매치종류 탭 한 줄 고정**: flex-nowrap + overflow-x-auto(scrollbar-hide), 모바일 px·글자 축소 — 💰 이적시장이 같은 줄 우측 유지
- **등급 아이콘**: `lib/nexon/division-icon.ts`(division→넥슨 CDN ico_rank 매핑, FO4 자산) + `DivisionIcon`(onError 시 자동 숨김 — 이미지 불가 시 기존 텍스트 그대로). ⚠️ 샌드박스 프록시로 CDN 미검증 — 배포 후 아이콘 안 보이면 URL 1개 조정
- 기타 모바일: 거래 정렬 셀렉트 44px, 거래 흐름 차트 min-w 520px + 가로 스크롤(축소 대신 가독성)
- Playwright 390/360px 검증: 홈·스쿼드·픽랭킹·커뮤니티·이적시장 + 히어로 레플리카 전부 가로 오버플로 0
- 단위 120 PASS, 빌드/타입체크 통과. PR #34

## 2026-07-15 — 성향 배지 + 진단 208룰 + 전적 페이지 재구성 + 정렬

- **히어로 성향 배지 2종**(HeroBadges, Suspense 스트리밍): ⚽ 공식경기 유형 + 💰 이적시장 유형 — 레벨 우측, 클릭 시 분석 탭/이적시장 이동, hover 설명. 데이터 없으면 생략
- **공식경기 진단** `lib/match/diagnosis.ts`: 지표 27종(연승/연패·클린시트·1골차·역습승·모멘텀 등) + **룰 101개**(유형 14 + 코멘트 87). 경기 기록 탭 "경기 성향 진단" 패널
- **이적시장 진단** `lib/market/diagnosis.ts`: 지표 18종 + **룰 107개**(유형 16 + 코멘트 91). 이적시장 페이지 "이적 성향 진단" 패널
- **이적시장 목록 정렬**(TradeList 클라이언트 분리): 최신순/높은·낮은 금액순/강화 높은순
- **전적 페이지 재구성**: 전적 카드 버튼 하단 이동, **라이브 세션 전체 삭제**(-640줄), 이적시장 진입을 매치종류 탭 줄 gold 탭으로
- **시각화**: 득점/실점 비율 바, 라이벌 승무패 바, 픽랭킹 경기 수 비례 바
- **홈**: HomeReturningStrip 삭제(/me와 중복), 검색 유도 카드 3장→1장 통합(6→4장)
- `lib/nexon/recent.ts` React cache()로 배지·경기기록 넥슨 조회 요청 단위 공유. tone 클래스 공용화(lib/diagnosis/tone.ts)
- 단위 테스트 **120 PASS**(+28). PR #33

## 2026-07-15 — 이적시장 금액 단위 표기 + 일별 거래 흐름 차트

- **formatKoreanBP / formatKoreanBPShort** (lib/format): 만/억/조/경 단위. 요약은 "4억 7,500만", 목록은 "4.75억" 축약. 원값은 title 툴팁으로 보존. 요약에 **순수지**(방출−영입, win/lose 색) 추가
- **일별 거래 흐름 SVG 차트** (TradeSection, 서버 렌더): 위=방출 수입(--win)/아래=영입 지출(--lose) 미러 막대. 마지막 거래일 기준 연속 14일(KST), 최대 수입/지출일에만 직접 라벨, 슬롯별 네이티브 `<title>` 툴팁, 데이터 끝만 둥근 barPath
- 색각 대응: win/lose 쌍은 deutan ΔE 5.8~7.5(dataviz 검증 스크립트 실측) → **위치+부호+범례 이중 인코딩**으로 색 단독 의존 제거. 다크/라이트 Playwright 렌더 확인
- 단위 테스트 +14건(bestFormationId 4 + 포매터 10) = **92 PASS**. PR #32

## 2026-07-15 — 스쿼드 실선발 불러오기 + 이적시장 독립 페이지 + 홈 정리

- **스쿼드 빌더 "닉네임으로 불러오기" 개편**: 최근 30경기 빈도 추정 → **가장 최근 공식경기의 실제 선발 11명**(SUB 제외, 그 경기 포지션 그대로). `bestFormationId()`(lib/squad/assign)가 선발 포지션 조합에 가장 근접한 포메이션을 판별해 **빌더 포메이션까지 자동 전환**. 최신 경기 데이터 불완전 시 최근 5경기 폴백. 대표 포메이션 6종 판별 검증
- **이적시장 독립 페이지 분리**: 거래 내역은 매치 종류와 무관 → 전적 서브탭에서 제거, `/market/[nickname]` 신설(TradeSection 이동). 전적 히어로에 💰 이적시장 버튼, 기존 `?view=market` 링크는 redirect 호환
- **홈 정리**: 검색 유도 반복 카드 3장(리포트/성적표/클리닉) → "전적·분석 리포트" 1장 통합(6→4장), 히어로 서브카피 한 줄 축약, 데모 링크 축약. 모바일에서 히어로 상단 "EA SPORTS FC ONLINE DATA LAB" 숨김
- **모바일 탭바**: 홈 버튼 제거(4탭 — 상단 로고로 대체). 홈 재방문 스트립 "다시 오셨네요"→"반가워요"
- 빌드/타입체크 통과. branch `claude/fconline-repo-setup-7nqd31`

## 2026-07-14 — 커뮤니티 조사 반영: 이적시장 거래 내역 탭

- 커뮤니티(인벤·디시·에펨·피온북·BSTPG·fifaaddict) 조사로 유저 니즈 파악: 스쿼드 추천/평가·**시세**·구단가치 계급·OVR/팀컬러·**거래내역**·클래스 가성비. 이 중 시세/OVR/팀컬러/예산추천은 공식 API 미제공(경쟁사 자체 크롤링) → 정직하게 제외. **거래내역은 공식 API가 제공** → 착수
- `api.getUserTrades(ouid, buy|sell)`: `user/trade`(우리 경로 관례 준수), 응답 `{tradeDate,saleSn,spid,grade,value}`
- `TradeSection`: 전적 5번째 서브탭 "이적시장" — 영입/방출 목록(이미지·시즌·강화·가격)+지출/수입 요약, 각 행 선수 도감 링크. graceful(경로 상이 시 안내로 강등, 크래시 없음)
- ⚠️ 신버전 경로 문자열은 문서 인증벽으로 추론 — 프로덕션에서 확인 필요(404면 문자열 1개 조정). 단위 78/78, 빌드 통과. PR #30
- 후속 기획 후보: 계급/등급 티어 카드(추가 호출 0), 클래스 가성비 컬렉션, 천적 카드

## 2026-07-14 — 데일리 회의 Day 1: 홈 발견성 + 선수 도감 링크 + 터치 폴리시

- 데일리 개선 회의(1주 프로그램) 자동 루틴 등록(매일 09:00 KST, 이 세션 self-bind, 7/21 종료 자동삭제). 오늘 첫 회의 수동 실행
- 3렌즈(모바일 실측 390px·편의성·재미) 수렴: **렌더 회귀 0(전 라우트 오버플로 0)**. 유일 문제 = 홈이 정적 브로슈어라 신규 기능 미노출("좋은 기능 숨김")
- **HomeReturningStrip**: 로그인/재방문 시 홈 상단 개인화(인사 + user_snapshots "지난 방문 대비 승률 ▲▼" + 최근검색 칩 + 내 전적·마이페이지 바로가기). 비로그인은 히어로 그대로
- 홈 기능 그리드 문구에 분석/최근7일폼·선수 도감·스쿼드 배틀 명시. 묻힌 선수 도감 → 선수 성적표 행에 `/player/[spid]` 링크
- 모바일: 빌더 조작부·푸터 링크 44px. Playwright 검증(오버플로0·44px), 단위 78/78. PR #29
- 내일 후보: 천적(Nemesis) 판정·공유 카드(topRivals 자산 활용), 오늘의 도전(reportInsights 미션화), 커뮤니티 배틀 상시 노출

## 2026-07-13 — 리텐션 P0: 개인 전적 스냅샷(지난 방문 대비) + 스쿼드 계정 연동

- 회의 P0("내일 또 올 이유 부재") 구조적 대응. migration **0015**
- **개인 스냅샷**: 로그인 유저가 본인 연동 전적 조회 시 `VisitRecorder`→`/api/me/snapshot`이 하루 1행(승률·평점·경기수) 기록. `user_snapshots` RLS 본인읽기/service_role쓰기, 서버가 verified_nickname 재확인. `/api/profile` GET이 최근 2개 delta 반환 → `/me` "지난 방문 대비" 카드(▲▼)
- **스쿼드 계정 연동**: `squads.user_id` 추가, 로그인 저장 시 귀속(크로스기기·lock-in), 익명 저장 유지. `store.listUserSquads` + `/me`가 서버 스쿼드 + 기기 스쿼드 병합
- 단위 78/78, 스모크 21/21. PR #28
- 🔴 배포 후 **0015 실행** 필요

## 2026-07-13 — 자체 점검 회의(3렌즈) → 모바일·발견성·배틀 마찰 개선

- **회의**: 모바일 렌더 스윕(390px)/편의성/재방문 3렌즈. 가로 오버플로는 전 라우트 이미 0px 확인. 지적 반영:
- **모바일 터치 타깃 44px**: 테마토글(36→44), 푸터 법적 링크(+py), 주요 CTA(/me·/player·/meta py-3)
- **발견성**: MobileTabBar 5탭화(내 정보/me 추가 — 마이페이지가 드롭다운에만 있던 문제), `/meta` 선수 이름 검색(PlayerSearch→선수 도감, 기존엔 이름으로 /player 갈 경로 0)
- **배틀 마찰**: 유형 선택 즉시 "A·B 두 스쿼드 필요" 안내 + 스쿼드<2 시 빌더 새 탭 CTA(초안 유지)
- Playwright @390px 검증(토글 44·5탭·검색·오버플로 0), 단위 78/78. PR #27
- **🔴 회의 P0 미구현(전략 과제)**: 개인 기록 누적 부재 → 재방문 트리거 비개인화 meta 1개뿐. 다음 한 수 = 진단/주간폼 결과 계정 단위 누적 저장(0015) + "지난 방문 대비" delta. 사용자 논의 후 착수 예정

## 2026-07-13 — 신규 기능 ⑤ 스쿼드 배틀 투표 (5개 요청 완료)

- 새 커뮤니티 유형 `squad_battle` — 두 스쿼드(A/B) 첨부 + 독자 투표. **migration 0014**(type CHECK에 추가), post-types 설정(squad+squad_b), 작성 폼 B팀 피커(meta.squad_b, A·B 필수), 상세에서 A/B 인라인 렌더 + `BattleVote`
- 투표는 기존 `vs_votes` 재활용(익명 voter, service_role, `vs_key=battle:{postId}`) — 새 테이블 불필요. `/api/community/battle` GET 집계 / POST 투표
- PR #26. 단위 78/78, 스모크 21/21
- 🔴 배포 후: **0014_squad_battle.sql 실행** 필요
- ※ 5개 신규 기능(도감·H2H·마이페이지·주간폼·배틀) 전부 완료

## 2026-07-13 — 신규 기능 ④ 주간 폼 추적

- `lib/nexon/report.ts` `computeWeekly()`: 최근 7일 vs 직전 7일 승률 비교(기준=최신 경기 시각, now 비의존·재현 가능). `MatchReport.weekly`
- 분석 리포트 상단 "최근 7일 N경기 · 승률 X% · ▲/▼ %p 지난주 대비" 스트립
- PR #25. (신규 기능 요청 중 4번, 단위 75/75)

## 2026-07-13 — 신규 기능 ③ 마이페이지 /me

- `/api/profile` GET에 내 최근 커뮤니티 글 포함. `app/me/page.tsx`: 연동 구단주 바로가기(전적·진단)+내 저장 스쿼드(기기 N/10)+최근 검색+내 글. 비로그인도 기기 스쿼드/검색 노출 + 로그인 CTA
- AuthButton 메뉴 🏠 마이페이지 추가, MySquadPicker `loadMySquads` export
- PR #24. (신규 기능 요청 중 3번, 단위 68/68)

## 2026-07-13 — 신규 기능 ② 라이벌 H2H 패널

- `lib/nexon/summary.ts` `topRivals()`: 2회 이상 만난 상대를 H2H 승/무/패+득실로 집계(순수·단위테스트 +3)
- 전적 페이지 "자주 만난 상대(라이벌)" 패널 — 각 행이 상대 전적으로 이동. 매치 상세는 이미 양팀 이름이 프로필 링크(TeamName)
- PR #23. (신규 기능 요청 중 2번, 단위 68/68)

## 2026-07-13 — 신규 기능 ① 선수 메타 도감 /player/[spid]

- 매일 수집하는 `ranker_stats_snapshot`만으로(넥슨 추가 호출 0) "랭커가 이 카드를 실제로 어느 포지션에서 어떻게 쓰는지" 표시하는 새 콘텐츠 축
- `lib/nexon/player-meta.ts` `getPlayerRankerMeta(spid)`: 최신 스냅샷 포지션별 평균(경기수/평점/골/패스%/드리블%/태클·인터셉트). `players.ts` `getPlayerBySpid()`: pid로 이름+시즌 변형
- `app/player/[spid]/page.tsx`: 히어로(사진·시즌·다른 시즌 카드)+포지션별 스탯 카드+빈 상태, ISR 1h. `/meta` 행·빌더 RankerStatPanel에서 도감 링크
- PR #22. (5개 신규 기능 요청 중 1번)

## 2026-07-13 — 스쿼드 빌더 UX 6종 + 커뮤니티 첨부 스쿼드 자동 펼침

- **드래그 스왑**: 선수를 다른 자리 위에 놓으면 교환(빈 자리면 이동), 빈 피치면 자유 배치 유지. `SquadPitch` `onSwap` + 최근접 슬롯 스냅(13% 임계, 드래그 종료 좌표 기준)
- **탭 검색**: 빈/채워진 자리 모두 탭 시 검색창 포커스 → 즉시 교체 검색(이전엔 채워진 자리는 랭커 패널만)
- **pid 중복 방지**: 시즌(spid 앞 3자리) 달라도 같은 선수(pid=spid%1e6)는 스쿼드에 하나만 — 빌더 `place()` + 서버 저장 라우트(`seenPid`) 양쪽. 인게임 규칙 일치
- **개인당 10개 제한**: `MAX_MY_SQUADS=10`, 저장 시 이 기기 my-squads 목록 꽉 차면 차단. 스쿼드가 익명 저장이라 기기 목록 기준(로그인 연동 아님)
- **커뮤니티 첨부 스쿼드 자동 펼침**: 글 상세에서 링크 대신 `AttachedSquad`로 피치+시즌 요약 인라인 렌더
- 단위 65/65, 스모크 18/18, 빌드 통과. PR #21

## 2026-07-13 — 스쿼드 카드에 선수 사진 + 시즌 엠블럼 임베드

- **요청**: 피치 카드 원형이 포지션 라벨이라, 앱 피치처럼 선수 사진·시즌 엠블럼 표시 요청
- **구현**: `renderSquadCard`가 선수 사진(넥슨 CDN 액션샷→기본 폴백)·시즌 엠블럼(seasonid.json seasonImg, 넥슨 도메인 allowlist)을 서버에서 받아 **data URI로 변환해 임베드**(Satori 외부 fetch 실패로 카드 깨짐 방지). fetch당 5s 타임아웃+실패 null
- `buildSquadCardElement`: data URI 있으면 사진 원형, 없으면 포지션 라벨 폴백 → 이미지 누락/차단이 카드를 안 깨뜨림(dev는 라벨로 graceful). `baseNodes`/빌더 순수 분리, 라우트 maxDuration=60
- **검증**: Satori가 data URI 이미지(사진+높이지정 시즌 배지)를 유효 PNG로 렌더 확인. 단위 65/65, 빌드 통과. 실사진은 prod에서 표시
- PR #20 squash merge

## 2026-07-13 — 스쿼드 공유 카드를 실제 포메이션 피치로 전면 교체

- **문제**: 스쿼드 카드가 매치/전적 카드와 같은 범용 텍스트 템플릿을 재사용 → 저장한 스쿼드가 "4-3-3/보엠 스쿼드/핵심:골키퍼"로 나와 실제 포메이션과 전혀 안 닮음(사용자 "전혀 다르다")
- **수정**: `lib/card/squad-card.tsx` `renderSquadCard()` — 11명을 실제 피치 포메이션 좌표에 배치(자유배치 x/y 반영, `/squad/[id]`와 동일 좌표계, 공격수 위·GK 박스). `squadCardTree()`로 트리/폰트 분리해 테스트 가능화. card/squad 라우트가 이를 사용
- **검증**: 로컬 CJK 폰트로 PNG 실렌더 → Satori 레이아웃 정상(~120KB), 4-3-3 전술판 육안 확인. 단위 65/65, 빌드 통과
- 직전 핵심선수 선정 수정(pickKeyPlayers)은 카드가 텍스트→피치로 바뀌며 카드에선 미사용이나 함수/테스트는 유지
- PR #19 squash merge

## 2026-07-13 — 스쿼드 카드 핵심선수 버그 수정 + QA 테스트 스위트

- **버그**: 스쿼드 공유 카드가 "핵심 선수"로 슬롯 배열 앞 2명(대개 GK·수비수)을 뽑아, 홀란이 최전방인 4-3-3인데도 골키퍼가 대표로 박힘(사용자 제보). 데이터 뒤바뀜 아니라 선정 로직 결함
- **수정**: `lib/squad/card-badges.ts` — `pickKeyPlayers()`가 공격 포지션 우선(작을수록 공격인 y, 자유배치 좌표 우선) 정렬로 선정, `topSeason()` 순수 함수 분리. match/user 카드는 집계 통계만 써서 무결(점검 완료)
- **테스트(요청: 전체 단위+통합)**:
  - `scripts/qa-unit-tests.ts` (`npm test`): 순수 로직 61 assert — 카드 핵심선수 회귀, report 집계/인사이트, summary, verdict 티어·톤게이트, rate-limit, ip-hash, formations, assign, presets, playstyle. 전부 통과
  - `scripts/qa-smoke.sh` (`npm run test:smoke`): 프로덕션 서버 HTTP 통합 18건 — 공개 200/관리자 은닉 404/인증 401·403/넥슨 graceful. 전부 통과
  - `scripts/qa-shim.cjs`: 테스트 컨텍스트에서 `server-only` 무력화(빌드 무관), `tsx` devDep 추가
- PR #18 squash merge

## 2026-07-13 — 분석 리포트 탭 (경쟁사 시각화 참고 + 자동 코칭)

- **설계 회의 3렌즈**(데이터 가용성 감사 / 모바일 시각화 설계 / 차별화 전략): 경쟁 서비스(fifaaddict류) 6패널 스크린샷 참고. 결론 = 순수 신규 가치는 "시간대별 득실"뿐, 나머지는 기존 ShotMap·성적표·플레이스타일과 중복 → 클론 대신 **차트는 근거·자동 코칭 문장이 주인공**인 FC Scope식으로 재구성. 데이터는 전부 이미 가져오는 30경기 상세 → 넥슨 추가 호출 0
- **`lib/nexon/report.ts`**: `aggregateReport()` — 시간대별 득실(경기별 골코드 판별 후 6밴드 버킷), 슛 타입 결정력(박스안/밖/헤딩/프리킥/PK 시도·성공), 폼 타임라인. `reportInsights()` — 후반막판/초반 실점, 후반 뒷심, 헤딩 결정력, 외곽 남발, 연승·연패, 대패를 처방 문장으로(임계 미달 시 침묵)
- **`ReportSection.tsx`**: 모바일 우선·차트 라이브러리 없음 — 버터플라이 CSS 막대(시간대), 시도·성공 겹침 막대(슛타입), viewBox SVG 컬럼(폼). 전부 width%/viewBox라 390px 가로 스크롤 0
- **`page.tsx`**: 4번째 서브탭 "분석"(스크롤 nav) + Suspense
- 히트맵/거리(m) 패널 의도적 제외(ShotMap 중복 + 좌표 미터 신뢰 불가)
- PR #17 squash merge, 타입·빌드·집계 단위검증 통과

## 2026-07-13 — 라이브 오픈 하드닝 (회의 5라운드 결과 구현)

- **회의 5R**: R1 독립 5렌즈(UX 74/신뢰성 71/보안 67/리텐션 61/성능 58, 평균 66) → R2 근거검증·실용성·사각지대 교차검증 → R3 작업 확정 → R4 구현 레드팀 → R5 조건부 GO. 핵심 수렴: 넥슨 팬아웃(콜드 34호출)에 rate limit 부재 = 키 정지 시 전 서비스 즉사(비대칭 리스크). 진짜 성장변수 = 시딩 실행 + 공유 링크 썸네일
- **넥슨 kill-switch(manual)**: `service_flags.nexon_paused` → `nexonFetch` 큐 진입 전 30초 캐시로 검사, **fail-open**(Supabase 순단이 넥슨을 안 막음). `/admin` "넥슨 조회 스위치" 토글(`/api/admin/service-flag`, invalidate). PAUSED 에러를 전적/from-user/live/verify에 정직 안내. 자동 429 백오프는 크론 자가치유 역회전 위험으로 제외(R4)
- **비로그인 IP rate limit**: `lib/security/rate-limit.ts` in-memory 소프트(40/분/IP, CGNAT 감안), `x-real-ip` 신뢰헤더. `/api/squad/from-user`·`/api/live`에 429+Retry-After. `/user`는 서버컴포넌트라 kill-switch+ErrorState로 커버
- **신뢰성 자가치유**: 랭커 tombstone은 성공 청크만 기록(순단 1회 하루열화 방지), 선수 인덱스는 실패 시 캐시 안 함+재시도(단 빈 인덱스는 graceful 반환해 정적 프리렌더 안 깨짐), `getUserBasic` try/catch(429/타임아웃/일시정지 분기, 재시도 연타 억제), MatchSection listOk(장애≠경기없음), middleware 이미지/카드 프록시 auth 제외
- **커뮤니티 rate limit**: 0013 — INSERT WITH CHECK not-exists 시간창(글 30초·댓글 10초) + (author_id, created_at desc) 인덱스, API 사전체크 이중방어. 신규유저 첫 글 통과
- **성장**: 스쿼드/매치 OG 이미지(기존 카드 라우트+절대 SITE_URL), 동적 sitemap(공개 스쿼드/글, hidden=false 명시필터, ISR)
- 🔴 **배포 후**: 0013 실행 + `NEXT_PUBLIC_SITE_URL`(필수 승격, 미설정 시 프리뷰 도메인 썸네일) + kill-switch 동선 숙지. DEFER: 자동백오프·분산 rate limit·match_cache TTL·개인기록축적·사칭 정교대응
- PR #16 squash merge, 타입·빌드·로컬 스모크 통과

## 2026-07-13 — 빌더 선수 랭커 실전 스탯 패널 (능력치 대체)

- **판정**: 카드 오버롤·상세 능력치·고유 특성은 넥슨 공식 오픈 API 미제공(정적 메타 5종뿐 — spid/seasonid/spposition/matchtype/division). 팬사이트(인벤·fifaaddict 등)는 자체 수집 DB라 공식 경로 없음 → 공식 데이터 대체재로 **그 카드를 쓴 랭커들의 경기당 평균 실전 스탯** 표시
- **`GET /api/players/ranker-stat?spid&pos`**: 빌더 포지션 라벨→spposition 후보(중앙/좌우 변형) 매핑, `ranker_stats_snapshot` 일일 캐시(tombstone 포함) 경유, 표본 최대 변형 채택
- **`RankerStatPanel`**: 평점 배지 + 골/도움/슛(유효)/패스%/드리블%/태클·인터셉트 6타일 + 표본 수 + 미제공 사실 안내. spid×pos 세션 캐시
- **빌더 동선 변경**: 채워진 슬롯 탭 = 스탯 패널(검색 이동 X) / 빈 슬롯 탭 = 기존 즉시 검색. 안내 문구 갱신
- PR #15 squash merge, 타입·빌드 통과. 실데이터 수치는 프로덕션에서 확인 필요(개발 환경 넥슨 차단)

## 2026-07-13 — 픽 랭킹 원클릭 시딩 도구 (수동 시딩 대체)

- **질문 판정**: 넥슨 `/fconline/v1/ranker-stats`는 랭커 "목록"을 주는 API가 아니라 우리가 지정한 선수(spid)×포지션 후보의 랭커 평균 스탯을 돌려주는 **조회형** — 수동 시딩(구단주명 20~30건 검색)을 단독 대체 불가. 대신 검색 단계 자체를 서버가 대신하도록 자동화
- **`POST /api/admin/seed`** (관리자 전용, maxDuration 300s): 닉네임 ≤5개 → ouid → 최근 공식경기 30판 수집(match_cache 축적) → 방금 수집한 경기에서 선수×포지션 빈도 집계 → 상위 60개 조합 랭커 스탯 즉시 워밍 (크론 curl 수동 실행 불필요)
- **`/admin` "픽 랭킹 시딩" 섹션**: textarea에 줄바꿈/쉼표 구분 입력 → 닉네임별 ✓/✗ + 경기 수 + 워밍 결과 + 반영 안내(캐시 최대 1시간, ▲▼는 익일 크론 후)
- LAUNCH-CHECKLIST §3.5 재작성: 시딩 절차가 "닉네임 5개 붙여넣기"로 축소, ranker-stats 조회형 사실 명시, §5 실데이터 검증 검색이 최소 시딩 겸용
- PR #14 squash merge, 타입·빌드 통과

## 2026-07-13 — 스쿼드 빌더 상시 자유배치 + 탭 즉시 검색 + 팀컬러(시즌) 패널

- **자유 배치 상시화**: custom 토글 제거. `SquadPitch`가 탭(선택)·포인터 드래그(이동, 6px 임계로 탭 오인 방지)·HTML5 드롭(배치)을 동시 지원 — touch-none은 슬롯 버튼에만 적용(피치 빈 영역 스크롤 유지). 검색 카드·시즌 칩 상시 드래그
- **포지션 탭 → 즉시 검색**: 슬롯 탭 시 검색 입력 포커스+전체선택(PC/모바일), 모바일은 패널 스크롤 겸행
- **배치 후 자동 다음-슬롯 선택 제거**: 시즌까지 고르면 선택 해제+시즌 패널 접힘 → 사용자가 다음 포지션을 직접 탭(모바일은 피치로 복귀). "계속 선택되는" 불편 해소
- **팀컬러**: 넥슨 공식 메타 5종에 클럽/국가 팀컬러 없음 확인 → 시즌 팀컬러를 공용 `SeasonMix`("팀컬러 (시즌)") 패널로 빌더+`/squad/[id]` 뷰 양쪽 표시, 주력 시즌(3장+) 골드 강조 + 미제공 사실 명시
- Playwright 실검증(토글 0·탭 포커스·드래그 이동), 빌드 통과. PR #13 squash merge

## 2026-07-13 — 3라운드 GO/NO-GO 회의 + 게이트 6종 구현

- **3라운드 회의**(에이전트 9명: R1 5렌즈 독립평가 → R2 악마의변호인/실용주의/근거검증자 교차비판 → R3 의장 수렴): **조건부 GO, 63점** (R1 평균 57 → R2 38/73/58 → R3 63). Workflow 도구 반복 장애로 Agent 병렬 호출로 동일 구조 실행
- R2가 발굴·확정한 신규 결함: 작성자가 자동 숨김을 REST로 되돌리는 구멍 / 무음 부분실패(부분 데이터로 승률 계산) / OG 크롤러의 넥슨 호출 증폭 / 넥슨 호출 무타임아웃 / 시즌 칩 31px / vercel.app 하드코딩 4곳. 기각 2건(/meta 배지 "전부 NEW" — 3-state로 이미 방어 / 로그인 "준비 중" — 개발환경 산물)
- **게이트 6종 구현**(PR #12): ①`0012_launch_hardening.sql` — hidden 보호 트리거 + 숨김 SELECT RLS 차단 + consented_at ②nexonFetch 8s 타임아웃 + isRateLimited ③OG·카드 s-maxage=3600 + maxDuration=60 ④부분 실패 시 "M중 N경기 기준" 배너 ⑤`NEXT_PUBLIC_SITE_URL` env 일원화(`lib/site.ts`) ⑥시즌 칩 44px + 동의 서버 기록 + 만14세 조항(약관·로그인)
- 운영 런북(사칭 해제·긴급 숨김·신고 요약 SQL) 체크리스트 §6 추가
- 🔴 **배포 후**: `0012` SQL 실행 + 운영 3종(실데이터 검증 반나절 / meta 시딩+Analytics 30분 / 런북 10분) → **소프트 런칭**
- 회의 4주 방향: W1 소프트 런칭(도메인 구입·커뮤니티 1곳) → W2 빈 탭 결단 → W3 신고 루프 실전+소유권 검증 자동화 → W4 D1/D7 데이터로 다음 결정. 금지: 분산 레이트리미터·밴 시스템 선행 개발, 체크리스트 외 신규 기능으로 오픈 지연

## 2026-07-12 — 운영 콘솔·댓글 알림·공지 배너 + 모바일 오버플로 전수 점검

- **`/admin` 운영 콘솔**: `ADMIN_EMAILS` 화이트리스트(미등록 404 fail-closed). 신고 인박스(대상별 그룹·사유 분포·미리보기·숨김/해제/삭제, service_role `/api/admin/moderate`) + 공지 관리(게시 시 기존 자동 교체·내리기, `/api/admin/notice`)
- **댓글 알림**: `/api/me/notifications`(마지막 확인 이후 내 글 새 댓글, 내 댓글 제외) → AuthButton 카운트 배지 + 메뉴 "💬 새 댓글" 섹션(글별 +N 최대 3개), 메뉴 열면 확인 처리(localStorage)
- **공지 배너**: `0011_notices.sql`(활성만 공개 읽기) + 헤더 아래 배너, 공지별 닫기 기억. 클라이언트 fetch(`/api/notice`, s-maxage=60)라 정적 페이지 영향 없음
- **모바일 점검(요청)**: 12 라우트 × 375/390px 가로 오버플로 전수 검사 → **전부 0px**. privacy 표를 내부 스크롤→랩핑형으로 전환(375px 0px 검증)
- PR #11 squash merge, 빌드·타입 통과
- 🔴 **배포 후**: `0010`+`0011` SQL 실행, `ADMIN_EMAILS` env 추가+재배포
- 다음: 운영 5종 마무리 → 1단계 소프트 정식(지인) → 2단계 커뮤니티 공유

## 2026-07-12 — 정식 오픈 준비 A안: 법적 기반·신고·수정·Analytics·SEO

- **정식 오픈 진단**(62/100, 코드 검증 기반): 코어 강함 / 외곽(법·운영·측정·데이터 검증) 공백 → A안(1주 정비 후 정식) 채택
- **법적 기반**: `/terms`(팬서비스 고지·UGC 금지행위·책임 제한) + `/privacy`(수집 항목·목적·파기·위탁·권리, 문의 boheme88@naver.com) + **로그인 동의 체크 필수화**(동의 시점 로컬 기록) + 푸터 링크
- **신고·운영**: `0010_reports.sql` — reports(1인 1신고, RLS insert-own) + hidden 플래그 + **5건 자동 숨김 트리거**. 글·댓글 신고 버튼(사유 4종), 숨김은 목록/스레드 제외(작성자에겐 배지)
- **글 수정**: PATCH edit 모드(유형 고정·필드 화이트리스트) + GET 프리필 + `/community/[id]/edit` + 상세 수정 버튼
- **측정·SEO**: @vercel/analytics(대시보드 Enable 필요), sitemap/robots/metadataBase, `/community`·`/meta`·`/squad` 로딩 스켈레톤
- PR #10 squash merge, 빌드·타입 통과
- 🔴 **배포 후**: ①`0010_reports.sql` 실행 ②Vercel Analytics Enable ③문의 이메일 확인 ④실데이터 검증 1회전 ⑤운영 시딩 3종(/meta·데모 env·시드 글)
- 다음: 위 5개 완료 → **정식 오픈**

## 2026-07-12 — 커뮤니티 모바일 중심 재설계

- **목록**: 유형 필터 3줄 랩핑 → **한 줄 가로 스크롤 칩 바**(헤더 아래 sticky, `.scrollbar-hide`) / 카드에 제목 2줄·본문 1줄 미리보기·🧩스쿼드 배지·메타 칩·**💬 댓글 수** / 모바일 글쓰기 **FAB**(탭바 위 고정, 데스크톱은 상단 버튼 유지)
- **`0009_comment_count.sql`**: community_posts.comment_count + 트리거(insert/delete, 기존 백필). posts 조회를 `*`로 바꿔 미실행 환경에서도 목록 정상(카운트만 0)
- **댓글**: 이니셜 아바타(이름 해시 색 고정) + 말풍선 레이아웃, 제안 스쿼드 칩을 말풍선 안으로
- 상세·작성·프로필 하단 여백 보정(모바일 탭바 겹침 제거)
- 모바일 스크린샷 검증(칩 스크롤·FAB·빈 상태), 빌드·타입 통과. PR #9 squash merge
- ⚠️ **배포 전**: SQL `0009_comment_count.sql` 실행(미실행 시 댓글 수만 0 표시)
- 다음: 운영 시딩 3종 후 오픈

## 2026-07-12 — 폰트 표준화 + 픽 랭킹 변동 배지 + 오픈 전 전 기능 점검

- **폰트 스케일 표준화**: 본문 15→16px, 13px→14px(text-sm)·12→13·11→12·10→11 전면 상향 — 일반적 한국 서비스 스케일(최소 캡션 12px). 모바일 가독성 스크린샷 확인
- **픽 랭킹 변동 배지**(FUN 루프1 1번): 전일 스냅샷과 라인 내 순위 비교 → NEW/▲n/▼n. `loadPicks`를 rowsForDate/groupByLine으로 리팩토링, 후보 날짜 4개 중 채택일 다음 후보를 직전 스냅샷으로 사용
- **오픈 전 전 기능 점검**(Playwright 13 라우트 + 홈 링크 크롤): 전 라우트 정상 상태코드, 브랜드 404 동작, 깨진 내부 링크 0 — **동작 불능 기능 없음**. `_rsc` REQFAIL은 프리페치 중단(정상), `/live` 503·검색 빈 결과는 개발 환경 넥슨 차단(프로덕션 정상). curl 한글 미인코딩 400은 브라우저 무관
- **`docs/FUN-ROADMAP.md`**: 재미 기획 — 4개 루프(데일리 훅/자랑/겨루기/탐험) × 항목별 노력(S/M/L)·데이터 가용성. 착수 순서: ①변동 배지(완료) ②오늘의 내 폼+뜨는 카드 ③주간 챌린지 운영 ④베스트 답변 채택+코치 포인트
- PR #8 squash merge, 빌드·타입 통과
- 다음: 운영 시딩 3종(/meta·데모 env·시드 글) 후 오픈 → FUN 로드맵 2번 착수

## 2026-07-11 — 시즌 로고 배지 + 선수 사진 시즌별 확인

- **시즌 로고 이미지**: `/api/season-image/[seasonId]` 프록시(seasonid.json `seasonImg`, 넥슨 도메인 화이트리스트, 메타 1일·이미지 1주 캐시) + `SeasonBadge` 클라이언트 컴포넌트(로고 우선, 실패 시 기존 텍스트 칩 폴백). 빌더 검색 결과·시즌 선택 칩·피치 슬롯(빌더+공유 뷰)·`/meta` 픽 랭킹에 적용
- **선수 사진은 이미 시즌별** ✅: player-image 프록시가 `playersAction/p{spid}.png`(시즌별 액션샷) 우선 → 기본 사진(pid) 폴백. 시즌 선택 시 spid가 바뀌므로 사진도 자동 변경 — 수정 불필요 확인
- 로컬 검증: season-image 404(넥슨 차단)→텍스트 폴백·400 검증, 빌드 통과. PR #7 squash merge
- ⚠️ 실제 로고 렌더 모양(크기·비율)은 프로덕션에서 확인 필요
- 다음: 운영 시딩(/meta·데모 env·시드 글) 후 오픈

## 2026-07-11 — 리텐션 기능 7종 + 최종 오픈 준비 회의 (조건부 오픈 판정)

- **백로그 7종 구현**: 데모 체험(`NEXT_PUBLIC_DEMO_NICKNAME`, `lib/demo.ts`) / 최근 검색 칩(localStorage 5개) / 유형별 작성 템플릿 + `docs/LAUNCH-CHECKLIST.md`(시드 글 문안) / 빌더 시즌 구성 카운터(급여·클럽 팀컬러는 공식 API 미제공 → 시즌 구성으로) / 내 스쿼드 첨부 피커(`MySquadPicker`, 저장 시 자동 기록) / 스쿼드 공유 카드 시즌 배지 / **랭커 픽 랭킹 `/meta`**(스냅샷 재활용, 라인별 TOP10, 헤더·홈·모바일 탭 연결)
- **최종 회의(4렌즈: 경쟁·리텐션·사용성·코드검증 + 종합)** → **조건부 오픈 가능** 판정. 무기: 선수별 실사용 성적표(경쟁 부재 확인)·클리닉·공유 카드·커뮤니티 구조. 약점: 선수 상세/시세 부재(공식 데이터센터 딥링크로 완화 예정, P1)·빌더 급여/OVR 부재
- **회의 P0 코드 반영**: `/meta` 날짜 선택 결함(tombstone 제외+최소 행+전일 폴백+결정적 정렬 — 자정 직후 빈 랭킹 차단) / 크론 콜드스타트 폴백(직전 스냅샷 재예열 — 시딩 1회 후 자동 유지) / `isPostType` Object.hasOwn(`?type=constructor` 크래시) / 커뮤니티 글<5 시 유형 칩 숨김 / 모바일 중복 검색 탭→픽 랭킹 / AuthButton "내 전적" / 피커 값 초기화 / `/meta` 빈 상태 문구
- PR #6 squash merge, 빌드·타입 통과
- 🔴 **오픈 전 운영 작업**(LAUNCH-CHECKLIST §3.5): ① /meta 시딩(랭커 20~30건 검색→크론 수동 1회→4라인 확인) ② `NEXT_PUBLIC_DEMO_NICKNAME` env+재배포 ③ 커뮤니티 시드 글 8~15건
- P1(오픈 직후 1주): 성적표→공식 데이터센터 딥링크, 빌더 급여 합계, /meta 순위 delta 배지, /squad 내가 만든 스쿼드 목록
- 다음: 운영 시딩 후 오픈 / 실데이터 검증

## 2026-07-11 — 스쿼드 빌더 대개편 + 오픈 전 UX 총점검 (멀티 에이전트)

- **스쿼드 빌더**: 포메이션 19종(4백11/3백5/5백3, 행 기반 생성기 `lib/squad/formations.ts`) + **접힘형 picker**. 포메이션 전환 시 선수 **포지션 기반 자동 재배치**(`lib/squad/assign.ts` 3단계: 정확→라인→잔여). PC 우측 고정 검색 패널 **드래그앤드롭**(시즌 변형 포함), 모바일 자리 탭→검색 패널 자동 스크롤+포커스→**다음 빈 자리 연속 배치**. **내 스쿼드 불러오기**(`/api/squad/from-user` — 최근 30경기 실사용 라인업). 중복 선수 이동 처리, 프리셋 포지션 기반 전환(배치 로직 공유), 검색 스피너 고착·응답 역전 수정. 포메이션·배치 484 어서션
- **오픈 전 점검**: Workflow 6에이전트(비주얼/모바일/첫방문자/게이머/카피·접근성→종합)가 스크린샷 14장+코드 리뷰 → P0 7건·P1 10건·기능 니즈 TOP 8 도출, **P0 전부 + P1 7건 반영**:
  - 홈 죽은 카드 3장 → 히어로 검색 포커스(`FocusSearchCard`), 모바일 검색 탭 홈에서도 동작, 히어로 SVG 정리
  - **커뮤니티 댓글**(`0007_comments.sql`) — 제안 스쿼드 첨부 가능, "평가해줘" 루프 완성
  - **스쿼드 저장 IP 해시 일 20회 한도**(`0008_squads_rate_limit.sql`, `lib/security/ip-hash.ts` — IP_HASH_SALT 또는 service key 파생 솔트)
  - 에러 UX: not-found 닉네임 프리필 재검색 / 일시 오류 "다시 시도" / 프로덕션 내부 env 용어 숨김 / 브랜드 `error.tsx`·`not-found.tsx`
  - picker 대비, 저장 헬퍼 문구, 커뮤니티 빈 상태 CTA, 데스크톱 헤더 내비, 헤더 safe-area, 로그인 리다이렉트 type 보존
- Playwright 실검증: 홈 카드 클릭→hero-search 포커스, 모바일 슬롯 탭→scrollY 505+검색 입력 포커스. PR #5 squash merge
- ⚠️ **배포 전**: SQL `0007_comments.sql`, `0008_squads_rate_limit.sql` 실행
- **기능 니즈 TOP 8**(에이전트 발굴, 백로그): F1 데모 구단주 원클릭 체험(S) / F2 커뮤니티 콜드스타트 시드+템플릿(S) / F3 카카오 로그인(S~M) / F4 최근 검색 칩+검색 화면(S~M) / F5 급여 한도+팀컬러 계산(M) / F6 내 저장 스쿼드 첨부 피커(M) / F7 스쿼드 공유 이미지 카드(M) / F8 랭커 픽률 랭킹 페이지(M)
- 다음: 실데이터 검증 / 백로그 착수 순서 결정

## 2026-07-10 — 커뮤니티 2탄: 6유형 통합 게시판 + VS 제거

- **VS 모드 제거**: "오늘의 VS"(선수 비교 투표)가 랭커 데이터 의존이 커 콜드스타트에 안 붙어 제거. 삭제 `/vs`·`/api/vs`·`/api/card/vs`·`lib/vs.ts`·홈 티저·모바일 탭. "vs 상대" 텍스트, TugOfWar(평점 vs 랭커)는 유지
- **6유형 통합 게시판**(club_posts 일반화): `0006_community_posts.sql` — `type`(✨자랑/📝평가요청/🛠️만들어줘/🛡️클럽원모집/⚔️클럽전/🏆대회) + region/positions/contact/squad_id + jsonb meta. RLS + **DB CHECK 제약**(type·status·길이·포지션 수·squad_id 형식·meta 크기)로 API 검증을 DB에서도 강제
- `lib/community/post-types.ts`(유형별 필드/라벨 공용), `lib/community/posts.ts`(서버 읽기), `/api/community/posts`(유형별 필드 게이팅+화이트리스트)·`/[id]`(작성자 전용 PATCH/DELETE)
- `/community`(유형 탭+페이지네이션), `/community/new`(유형별 맞춤 폼), `/community/[id]`(유형별 상세+첨부 스쿼드+작성자 전적 카드). 구 `/community/clubs/*` 제거, 홈·계정 메뉴 `/community` 연결
- **에이전트 감사 반영**: 유형 게이팅·RLS·XSS·경계 정상 확인 / DB CHECK 방어 심화(anon 직접 insert 우회 차단) / squad_id 영숫자 검증 + href 인코딩
- PR #4 squash merge, 빌드·타입 통과
- ⚠️ **배포 전**: SQL `0006_community_posts.sql` 실행
- 다음: 스쿼드 빌더 개편(전체 포메이션 + PC 드래그앤드롭 + 모바일 + 내 스쿼드 불러오기), 외부 API(API-Football 키 필요)

## 2026-07-10 — 커뮤니티 1탄: 인증 스택 + 클럽 모집 (Phase 5a)

- **인증 기반**(fconline 최초): `@supabase/ssr` 클라이언트(client/server/middleware) + 루트 `middleware.ts`(세션 갱신), Google OAuth `/login` + `/auth/callback`(PKCE), `lib/security/safe-redirect.ts`(오픈 리다이렉트·제어문자·login/auth 루프 차단, 13 어서션)
- **`0004_profiles.sql`**: profiles(닉네임 ci-유니크 + FC Online 구단주명 연동 ouid + updated_at 트리거) + RLS(공개 읽기·본인만 쓰기) + `verified_ouid` 부분 유니크. `/api/profile`(닉네임 upsert)·`/api/profile/verify`(구단주명→ouid 해석) + `/profile/setup` + 헤더 `AuthButton`
- **`0005_club_posts.sql`** + 클럽 모집: `/community` 허브, `/community/clubs`(지역 필터·페이지네이션), `/new`(작성), `/[id]`(상세·마감/삭제·**작성자 전적 카드 자동 첨부**). RLS: 공개 읽기 / 작성=로그인+닉네임 / 수정·삭제=작성자. 헤더·모바일 탭 커뮤니티 진입
- **에이전트 2종 감사(보안·RLS + Next 코드) 반영**: ouid DB 유니크+23505 처리(중복 연동/경쟁 차단), 프로필 조회 예외 방어, 페이지 clamp, 리다이렉트 하드닝, 드롭다운 Esc/레이스 가드. 서비스롤 미사용·IDOR/XSS 없음 확인
- PR #3 squash merge, 빌드·타입체크 통과
- ⚠️ **배포 전 설정**: SQL 0004·0005 실행 + Supabase Google OAuth 활성화(+ `/auth/callback` 리다이렉트 URL) + ANON_KEY 확인
- ⚠️ **한계**: 구단주명 "연동"은 존재 확인일 뿐 소유 증명 아님(사칭 방지 토큰 챌린지는 후속). 유저 대회·교류전(5b/5c)은 준비 중
- 다음: 실데이터 검증 / 커뮤니티 확장

## 2026-07-10 — 스쿼드 클리닉 (로드맵 Phase 2, 룰베이스 진단)

- `lib/squad-clinic.ts` `diagnoseSquad()` — "선수 성적표"(나열)를 **처방적 진단**으로 종합. 종합 점수(0~100) + 밴드(top/strong/balanced/building/rebuild), 라인별(공격/미드/수비/GK) 평점·랭커 대비 gap, 약한 고리, 강점, 이슈 리스트(weak-link / over-reliance / thin-line / low-ranker-coverage). **AI 미사용**, 이미 집계된 players + 랭커 맵 재사용 → **추가 넥슨 호출 0**
- `SquadClinic.tsx`(서버 컴포넌트) — 종합 점수 conic 다이얼 + 라인 바 + 강점/약점 칩 + 처방. `SquadSection` 성적표 위에 배치, 실전 가치는 `clinic.squadRating` 재사용
- **에이전트 2종 감사(data-auditor + code-reviewer) 반영**: (H1) 약한 고리·강점 집합 상호 배타 → 동일 선수 양쪽 동시 노출 모순 제거 / (H2) 강점 보충 하한을 스쿼드 평균 이상으로 → 부진 스쿼드 오진 방지 / (M1) 랭커 대비 보정을 커버리지로 감쇠 → 소수 벤치마크 과반영 방지 / 다이얼 마스크 bg-surface 정정 / sampleGames 오라벨 → 실 경기 수 전달 / weak-link 이슈를 표시 3건과 정합 / thin-line에 MID 추가
- 엔진 21 어서션(8 시나리오: 중복 금지·하한·감쇠 포함) 통과, `npm run build` 통과. PR #2 squash merge
- ⚠️ 밴드·앵커·이슈 임계치는 coldstart 추정(BETA) — 실데이터로 보정 필요
- 다음: 실데이터 검증

## 2026-07-10 — 선수 시즌 표시 + 슛 히트맵 + FC Scope 리브랜딩

- **선수 시즌 표시**(핵심): `lib/nexon/players.ts`를 seasonid.json + spid.json 동시 로드로 재작성. 검색 결과가 `season`(대표 시즌명) + `seasons[]`(시즌 변형, spid 내림차순, 최대 16) 반환. 사용자가 카드별로 어느 시즌을 써야 하는지가 중요 → 스쿼드 빌더 검색에 **시즌 선택 드롭다운(펼치기)** + 피치·프리셋·저장뷰에 **골드 시즌 배지**
- `lib/squad/store.ts`: SquadSlot이 시즌 정보 보유, resolvePreset가 hit.season에서 시즌 도출. `/squad/[id]` 조회는 getSeasonNames로 시즌 해석
- **슛 히트맵**: `PlaystyleSection`에 최근 경기 누적 슛 히트맵(ShotMap + detectGoalCode) — 아키타입 시각 근거(박스 집중=포처형 / 외곽 분산=난사형)
- **리브랜딩 FC Lab → FC Scope**(기존 동명 서비스 충돌 회피): UI 워드마크, 카드 엔진(render.tsx), OG 이미지, manifest, 공유 파일명(fcscope-card.png), 테마 키(`fcscope-theme`) 전반 반영. 잔여 브랜딩 grep 클린 확인
- PR #1 squash merge, 빌드 통과
- ⚠️ 실데이터 검증 대기(사용자 요청대로 개발 후 일괄): 슛맵 좌표 방향·골 감지, 시즌 표시, 프리셋 한글명 spid.json 보정, 플레이스타일 ANCHOR 실측 보정(BETA)
- 다음: 실데이터 검증

## 2026-07-10 — 스쿼드 빌더 + 리그·팀 프리셋

- `/squad` 빌더(client): 포메이션 4종 선택 → 피치 슬롯 탭 → 선수 검색 모달(디바운스) → 배치 → 저장·공유. 리그·팀 프리셋 드롭다운으로 자동 채우기
- `SquadPitch`(빌더·조회 공용, 슬롯 좌표 배치), `/squad/[id]` 공유 뷰 + 스쿼드 카드
- 데이터: `lib/nexon/players.ts` searchPlayers(실선수 pid 그룹핑), `lib/squad/{formations,presets,store}`, `0003_squads.sql`(공유 읽기 RLS)
- 프리셋(큐레이션): 프리미어리그(아스날·맨시티·리버풀·토트넘)·라리가(레알·바르사) — 이름을 spid.json에 best-effort 매칭, 못 찾은 슬롯은 사용자가 채움
- API: `/api/players/search`, `/api/squad`(저장, 입력 검증), `/api/squad/preset`(해석), `/api/card/squad/[id]`
- 홈 기능카드 + 모바일 탭바에 "스쿼드" 추가
- 조사 반영: API-Football(/players/squads) 주력 + TheSportsDB 폴백은 추후 키 연동으로 팀 커버리지 확장. 지금은 큐레이션 프리셋으로 시작(외부 키 불필요). 이미지·이름 매칭은 spid.json 기반
- ⚠️ `0003_squads.sql` Supabase 실행 필요(저장 기능). 프리셋 한글명은 실 spid.json으로 검증·보정 필요
- 다음: 실데이터 검증

## 2026-07-10 — 라이트/다크 테마 + 가독성 개선

- **라이트/다크 테마**: globals.css 토큰을 2벌(다크="스타디움 나이트" 라임 / 라이트="스타디움 데이" 화이트+딥그린). 시스템 설정 기본 + `data-theme` 강제, 헤더 `ThemeToggle`(해/달) + localStorage + 무플래시 인라인 스크립트. 라이트에선 accent=딥그린(#3f7d10)으로 흰 배경 대비 확보, gold/win/lose도 라이트용 조정. stadium-bg는 `--glow`/color-mix로 테마 대응
- **가독성**: 화면 전반 최소 글자 10/11px → 12/13px 상향(유사앱 보조텍스트 최소 기준), body 15px
- 스쿼드 빌더 기반(진행중): `lib/squad/formations.ts`(4종 포메이션 슬롯 좌표), `lib/nexon/players.ts` 실선수 검색(pid 그룹핑, searchPlayers/resolvePlayer) — UI는 다음 단계
- (병렬) 축구 API·FC온라인 오픈소스 상세 조사 에이전트 실행 중
- 다음: 스쿼드 빌더 UI(포메이션 + 선수 검색 + 리그·팀 프리셋 + 저장/공유)

## 2026-07-10 — 심볼/파비콘 개편

- `lib/icon.tsx` — FC LAB 심볼: 구형 플라스크(연구실) 몸통 = 축구공(오각형 + 씨임 라인). favicon/apple-icon/icon-192/512 전부 이 마크로 통일

## 2026-07-10 — PWA 웹앱화 + 모바일 UI 최적화 + 스트리밍 리빌

- **PWA**: `app/manifest.ts`(standalone, theme-color, 아이콘), 생성형 아이콘(`lib/icon.tsx` → `icon.tsx`/`apple-icon.tsx`/`icon-192`/`icon-512`, 바이너리 무), appleWebApp 메타 + viewport-fit cover + safe-area
- **모바일 하단 탭바** `MobileTabBar`(홈/오늘의 VS/검색, active 라임, md:hidden, safe-area) → 모바일 앱 셸 완성. 헤더 "검색" 링크 제거, 검색 탭은 `/?focus=1`로 히어로 입력 자동 포커스
- **스트리밍 리빌**: 전적 경기 목록 스태거 팝인(카드 개봉 연출, 회의 #3)
- 홈 "COMING NEXT"(예정) → 실제 기능 안내 "여기서 할 수 있는 것"(매치리포트·선수성적표·라이브·오늘의 VS 링크)로 갱신
- 회의 롤아웃 6개 전부 완료
- 다음: 실데이터 검증(사용자 요청)

## 2026-07-10 — 카드 엔진 (회의 아이디어 #2, 9:16 공유 짤)

- `lib/card/render.tsx` — 단일 카드 엔진. 9:16(1080x1920) 전광판 타이포 PNG. 사진 임베드 대신 색+숫자(satori 폴백SVG 크래시 회피). `lib/card/font.ts` 한글 서브셋 로더
- 카드 라우트 3종: `/api/card/match/[matchId]`, `/api/card/vs`, `/api/card/user/[nickname]`
- `ShareCardButton`(client) — Web Share로 파일 공유(카톡·디시), 미지원 시 다운로드. 매치리포트·VS공개후·전적페이지에 "카드 저장·공유" CTA
- 심판 아이콘 글리프(▲★ 등)는 서브셋 폰트에 없어 카드에선 생략(테두리 색+텍스트로 인코딩), 목 렌더 스크린샷 검증 완료
- 회의 롤아웃 6개 중 5개 완료(카드 엔진 포함). 남음: 스트리밍 리빌 로딩
- 다음: 실데이터 검증(사용자 요청대로 개발 후 일괄)

## 2026-07-10 — 라이브 세션 모드 + 스쿼드 실전 가치

- `/live/[nickname]` — 켠 뒤부터 60→75초 폴링(탭 활성 시), 경기 종료 시 자동 팝인 + 세션 대시보드(전적·연승/연패·득실·평점 추이). `/api/live/[nickname]` JSON(캐시 경유)
- 구단가치는 공식 API에 시세 없음 → **스쿼드 실전 가치**로 대체(출전수 가중 평균 평점 → 심판 도장). 선수 성적표 상단 요약
- 전적 페이지 히어로에 "🔴 라이브 세션" 진입 버튼
- **에이전트 2종 자동 감사** 반영: H1 기준선 오염(빈 첫 응답 → 과거경기 세션 편입) → route `listOk` 신호로 조회성공 후에만 기준선 확정 / 일시오류 시 화면 소실 → 하드(not_found/not_configured)만 오류화면, 그 외 마지막 데이터 유지+"재연결 중" / 폴링 75s+응답 s-maxage=30(동시폴링 넥슨 부하 완화) / AbortController / aria-live+sr-only+prefers-reduced-motion / 점검 분기 / decode 가드
- ⚠️ 넥슨은 끝난 경기만 제공 → 경기 중 실황 불가(종료 후 반영 지연). 준실시간
- 다음: 회의 잔여(카드 엔진 9:16 공유, 스트리밍 리빌), 실데이터 검증

## 2026-07-10 — Sprint 3: VS 판독기 (회의 아이디어 #4)

- `supabase/migrations/0002_vs_votes.sql` — 투표(vs_key, voter, pick) PK로 1인1표, 서버 전용
- `lib/vs.ts` — canonicalPair/vsKey(A=작은 spId 정규화), buildComparison(랭커→비교모델+승자), getTodaysVs(스냅샷 근접쌍 자동 편성, KST 날짜 결정론), 투표 집계
- `/vs` — 슬램 등장(격겜 연출) + 심판 도장 + 예측 소프트게이트 투표(탈출구) + 정답 공개(tug-of-war 바 ▲이중인코딩) + 🎯안목 적중 뱃지(localStorage) + 유저 예측 %
- `VsReveal`(client, 낙관적 업데이트+서버0 가드), `/api/vs/vote`
- 홈 첫 화면 "오늘의 VS" 히어로 티저 (getTodaysVs만, 랭커 호출 X → 홈 고속 유지)
- **에이전트 2종 자동 감사** 반영: getTodaysVs 결정성(최신 스냅샷 필터+안정정렬, 같은날 같은쌍 보장), 파라미터 정수·범위 검증(임의 넥슨호출 열거 차단), 투표 API 타입+vsKey 정규식 검증, 투표바 B 중립색(C6), 무승부 배너, aria-live/label. 순서뒤바뀜(A/B) 정규화는 감사 결과 안전 확인
- ⚠️ VS는 ranker_stats_snapshot 축적이 전제 — 데이터 없으면 '오늘의 VS 준비 중' 안전 표시. CRON_SECRET 설정 + match_cache 축적으로 점진 활성화
- 다음: 회의 롤아웃 잔여(카드 엔진 9:16 공유, 스트리밍 리빌 로딩), 실데이터 검증

## 2026-07-10 — Verdict 심판 엔진 + 시각화 (회의 아이디어 #1·#5)

- `lib/verdict.ts` — 룰베이스 심판 코어. verdictFromRating: 평점→티어(GOAT~반등)+밈등급+한줄판정+색+아이콘, 결정론적(hashSeed) 문구. subjectType 3단 래더(self/player/otherUser)로 실유저 저격 톤 차단
- `VerdictStamp`(색+형태 이중 인코딩 도장), `TugOfWar`(내 평점 vs 랭커 발광 바, ▲/▼ 형태 인코딩)
- 선수 성적표 카드: 갭 텍스트 → 심판 도장 + tug-of-war 바. 매치 리포트: 결과 심판 도장
- 회의록 `docs/COUNCIL-2026-07.md` 저장 (4라운드 합의, 롤아웃 순서·시각화·청소년UX·VS설계·하지말것)
- **에이전트 2종 자동 감사** 반영: verdictFromMatch를 결과축(승▲라임/무=/패▼빨강) 이중인코딩으로 재설계(H1: 몰수승 모순·GOAT 승무패 구분불가 해결), otherUser 저티어 톤 호의화(H2), roast/pos 중복 제거(M1), TugOfWar ahead·floor·aria(M2), 카드 히어로 중복 정리(L2)
- 다음: Sprint 3 VS 판독기

## 2026-07-10 — 속도 개선: 매치 캐시 배치 조회

- `getMatchDetailsBatch(ids)` 추가 — 캐시를 `.in()` 한 번으로 읽어 30왕복→1왕복. 미스만 넥슨 호출 후 배치 upsert. 입력 순서(최신순) 유지
- MatchSection/SquadSection이 개별 `getMatchDetailCached` 루프 대신 배치 사용 → 재방문·캐시된 경기 조회 대폭 단축
- (진행중) 혁신 기능 다라운드 회의 오케스트레이션 실행 — 속도 추가개선/시각화/청소년UX/Sprint3 VS판독기 방향 수렴 대기

## 2026-07-10 — Sprint 2: 선수 실전 성적표 + 랭커 벤치마크 + 스냅샷 크론

- `lib/nexon/player-stats.ts` — aggregatePlayers: 최근 30경기 출전 선수별 누적(평균 평점·경기당 골/어시·패스 성공률·주 포지션). SUB·미출전(spRating0) 제외
- `lib/nexon/ranker.ts` — getRankerStatsCached: ranker_stats_snapshot 당일 캐시 + 미스만 라이브 배치(청크 20), 중복제거. **tombstone**(`payload.empty`)으로 데이터 없는 조합 재조회 차단. 날짜는 KST 기준
- `lib/nexon/api.ts` — getRankerStats 추가 (경로 `ranker-stats`)
- `/api/cron/ranker-snapshot` + `vercel.json` — 일 1회(KST 03시=UTC18시) match_cache 인기 선수 예열. **CRON_SECRET fail-closed**(미설정 시 401)
- `/user/[nickname]` — 서브탭(경기 기록/선수 성적표), SquadSection: 선수 카드 + 랭커 갭(내평점−랭커, +초록/−빨강/±중립), MIN_GAMES 2 표본 필터
- **에이전트 2종 자동 투입**: data-auditor(모의실행 6종 통과, 치명 버그 0) + code-reviewer. 반영: 경로 `rankerstats`→`ranker-stats`(치명), 크론 fail-open→closed, tombstone 캐싱, 동점 포지션 결정적 처리, 갭0 중립, KST 날짜, DB-SCHEMA 동기화
- ⚠️ `ranker-stats` 실제 넥슨 경로는 배포 후 실데이터로 최종 확인 필요. CRON_SECRET Vercel 설정 필요
- 다음: 실데이터 검증(슛맵 좌표·골판정·랭커 경로) → Sprint 3(VS 판독기)

## 2026-07-10 — 상시 에이전트 5종 정의

- `.claude/agents/` 추가: code-reviewer(도메인 체크리스트 리뷰), qa-verifier(Playwright 화면 검증), data-auditor(집계·좌표·골판별 정합성), trend-watcher(주간 커뮤니티 트렌드→VS 소재), user-panel(헤비/라이트/덕후 3인 사용성 판정)
- 랭커 스냅샷 수집(⑤)은 에이전트가 아닌 Vercel Cron으로 Sprint 2에서 구현 예정

## 2026-07-09 — Sprint 1: 매치 캐시 + 슛맵 리포트 + 히어로 재설계 + 공유 카드

- `lib/supabase/admin.ts` — service_role 클라이언트 (미설정 시 null → 캐시 없이 자연 강등)
- `lib/nexon/cached.ts` — match-detail Supabase 영구 캐시 (조회→없으면 넥슨→upsert)
- `lib/nexon/players.ts` — spid.json 이름 맵 (no-store + 모듈 메모이즈, Next 캐시 2MB 제한 우회)
- `/match/[matchId]` 매치 리포트 — 스코어보드 + 점유율 바 + **양측 슛맵**(SVG, 골=글로우/골대=금색) + POTM 카드(선수 이미지 첫 투입) + 팀 스탯 비교 + 선수 평점 리스트
- 슛 result 코드 스펙 불확실 → **총득점 대조로 골 코드 자동 판별**(detectGoalCode), 좌표 범위 이탈 시 자동 스케일. ⚠️ 실데이터로 좌표 방향 검증 필요
- 전적 페이지: 30경기로 확대, 히어로 전광판 카드, 폼 가이드(최근 10 WWDLL), 평점 스파크라인, 경기 행 → 리포트 링크
- `/user/[nickname]/opengraph-image` — 공유 시 전광판 카드(승률+폼) 자동 생성, 구글 폰트 런타임 서브셋 로드
- 슛맵 목 데이터 스크린샷 검증 완료. 다음: 배포 후 실데이터 검증(좌표 방향·골 코드) → Sprint 2(선수 실전 성적표 + 랭커 벤치마크)

## 2026-07-09 — Sprint 1 착수 준비

- 7인 에이전트 기능 전략 회의(마케터/개발자/기획자/디자이너/게이머 3인) 완료 — 합의: 슛맵+매치 리포트 1순위, 실측 퍼포먼스 데이터로만 승부, 모든 출력은 공유 카드로, 결론형(처방 1줄). 후순위: 시세/커뮤니티 게시판/현실 라인업(대회 연계로 재설계)
- 우선순위: ⓪매치 캐시 인프라 → ①매치 리포트+슛맵 → ②히어로 재설계+공유 카드 → ③선수 실전 성적표 → ④처방전(룰 기반) → ⑤VS 판독기. 사이드: 강화 시뮬
- `supabase/migrations/0001_core_cache.sql` 추가 — ouid_cache, match_cache(ouids gin), ranker_stats_snapshot. 전부 서버 전용(RLS on, 정책 없음 = service_role만 접근)
- 다음: 사용자 Supabase 프로젝트 생성 → SQL 실행 → Vercel env 3종 → Sprint 1 코드 작업

## 2026-07-08 — Phase 1: 넥슨 API 코어 + 전적 페이지

- `lib/nexon/` — client(순차 큐 + NexonApiError 분류), api(5개 엔드포인트, match-detail 영구 캐시/나머지 revalidate), meta(division·matchtype + 정적 폴백), summary(매치 요약·전적 집계)
- `/api/player-image/[spid]` — CDN 프록시 (액션샷 → pid 기본 이미지 → 실루엣 SVG 폴백)
- 디자인 시스템 "스타디움 나이트" — 다크 네이비 + 전광판 라임(#c8f542) + 골드, Chakra Petch(전광판 숫자) + IBM Plex Sans KR. 다크 단일 테마
- 홈: 히어로(피치 라인 아트 + 검색) + COMING NEXT 카드 3종
- `/user/[nickname]`: 프로필 + 최고 등급 카드 + 매치 탭(공식/감독/클래식) + 요약 전광판(승률·득실·점유율) + 최근 10경기 리스트, Suspense 스트리밍 + 스켈레톤
- 에러 상태: 닉네임 없음 / API 키 미설정 / 점검 중 구분 처리
- Playwright(데스크톱 1280·모바일 390) 스크린샷으로 반응형 확인. 캐시는 v1 Next fetch cache 사용(Supabase 캐시는 Phase 2에서)
- ⚠️ 원격 환경은 넥슨 도메인 차단 — 실 API 연동 테스트는 로컬/Vercel에서 필요 (`NEXON_API_KEY` 설정)
- 다음: Vercel 배포 + 실데이터 검증 → Phase 2 스쿼드 클리닉

## 2026-07-08 — Phase 0: 프로젝트 시작

- 저장소 생성·연결, Next.js 16 + Tailwind v4 스캐폴드 (create-next-app)
- 기획 문서 작성: ROADMAP(사이트맵·6개 기능·단계별 계획), NEXON-API 레퍼런스, DB 스키마 초안
- 사전 리서치 완료: 넥슨 오픈API 전체 분석, FC온라인/축구 오픈소스 조사, 커뮤니티 반복 주제 분석, 경쟁 서비스 분석 (요약은 ROADMAP 하단)
- 다음: Phase 1 — 넥슨 API 코어 (`lib/nexon/` 클라이언트 + `/user/[nickname]` 전적 페이지)

## 2026-07-10 — 스쿼드 빌더 리뷰 반영

- 코드리뷰(치명 0): 포메이션 교체 시 새 포메이션에 없는 슬롯 선수 정리(무음 손실 방지) + filledCount 유효슬롯 기준, 모달 Escape 닫기 + dialog/aria-modal/aria-labelledby, 검색 이미지 lazy, 저장 route slotId 중복 제거

## 2026-07-10 — 스쿼드 빌더 자유 포메이션 (커스텀 배치)

- SquadPitch 드래그 지원(포인터 이벤트, 탭=선수교체/드래그=이동), "자유 배치" 토글
- SquadSlot에 x/y 좌표 오버라이드 추가 → 저장/공유 시 커스텀 위치 유지. 저장 API 좌표 검증(0~100), 포메이션 교체 시 좌표 초기화
- (병렬) 플레이스타일 룰베이스 유형분류 설계 회의 진행 중

## 2026-07-10 — 플레이스타일 룰베이스 진단 (설계회의 스펙)

- 전문가 4인 회의(제안→비평→합의) → `docs/PLAYSTYLE-SPEC.md`. 결론: 룰베이스가 정답, 단 (등급×컨트롤러) 백분위+수축. 순수 절대임계는 등급 인플레로 쏠림
- `lib/playstyle.ts` — aggregatePlaystyle(유효경기 집계) + analyzePlaystyle: 5축(전개템포·스루침투·개인기·슈팅성향·수비압박) + 아키타입 10종 결정리스트(실력지표 미투입) + 강점/취약 칩(실행품질 오버레이). empirical-Bayes 수축 K=10
- v1 콜드스타트: tier anchor 고정값(백분위 데이터 없음) + BETA 배지. 데이터 누적 시 v2 백분위 승급
- `/user/[nickname]?view=style` 서브탭 — 아키타입 히어로 카드 + 양극 슬라이더/게이지 + 강점/취약 칩. 성향(주황)≠실력(초록/빨강) 색 분리
- 목 프로필 8종 실행 검증: 결정리스트 아키타입 분기 정상. ⚠️ ANCHOR 값은 추정치 — 실데이터로 보정 필요(수비축 포화 사례 확인). 성향≠실력 명시
- 다음: 실데이터 검증 + anchor 보정
