# DEVLOG

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
