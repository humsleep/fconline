# DEVLOG

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
