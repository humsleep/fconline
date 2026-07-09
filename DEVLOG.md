# DEVLOG

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
