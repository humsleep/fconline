<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — FC Online Lab

> 본질적이고 변하지 않는 정보만. 진행 이력은 `DEVLOG.md`, 전체 기획은 `docs/ROADMAP.md`.

---

## 1. 프로젝트

- **이름**: FC Online Lab (가칭) — FC온라인 유저를 위한 데이터 도구 + 커뮤니티
- **운영자**: humsleep — Boheme BlogLab(bohemebloglab.com)과 동일 운영자
- **저장소**: https://github.com/humsleep/fconline
- **배포**: Vercel (예정)

### 핵심 컨셉 (차별화)

기존 FC온라인 서비스(피파어딕트·피온디비·FC INNO 등)는 전부 **조회·나열**.
이 프로젝트는 **진단·자동화·검증**으로 차별화:

1. **스쿼드 클리닉** — AI 스쿼드 평가 + 예산 스쿼드 생성 (커뮤니티 반복 질문 "평가 좀"/"X억으로 뭐 사요" 자동화)
2. **VS 판독기** — 선수 비교 논쟁을 랭커 실사용 데이터(공식 ranker-stats)로 판정 + 유저 투표
3. **현실 라인업 스쿼드** — 실제 팀 최신 선발 11명 → FC온라인 카드 매칭 스쿼드 생성
4. **커뮤니티** — 클럽 모집 → 유저 대회(넥슨 API 결과 자동 검증) → 클럽 교류전

상세 기획·단계별 로드맵: `docs/ROADMAP.md`

## 2. 기술 스택

| 영역 | 도구 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, React 19, Turbopack) |
| 스타일 | Tailwind CSS v4 (토큰 기반) |
| 인증/DB | Supabase (Auth + Postgres + RLS) — 예정 |
| AI | Anthropic Claude (스쿼드 평가 리포트) — 예정 |
| 외부 API | 넥슨 오픈API (FC온라인), API-Football, 넥슨 CDN 이미지 |
| 호스팅 | Vercel |

### 외부 API 레퍼런스

- 넥슨 오픈API 전체 분석: `docs/NEXON-API.md` (엔드포인트·응답 스키마·에러코드·주의사항)
- DB 스키마 초안: `docs/DB-SCHEMA.md`

## 3. 개발 원칙 (Boheme BlogLab에서 검증된 패턴 계승)

- **API 키는 서버 라우트 전용** — 클라이언트에 절대 노출 금지 (`NEXON_API_KEY`, `API_FOOTBALL_KEY`, `ANTHROPIC_API_KEY`)
- **match-detail은 불변 데이터** → matchId 기준 영구 캐시 (Supabase)
- **넥슨 API 레이트리밋 대응** — 병렬 호출 금지, 순차 큐잉 (429 빈발 사례 확인됨)
- **선수 이미지는 CORS 이슈** → Next.js 이미지 프록시 경유
- 에러 분류는 `err.name` + `err.status` + message regex (production minify 대응)
- Supabase service role 키는 서버 전용 모듈에서만 import
- `useSearchParams` 쓰는 페이지는 `<Suspense>` wrap 필수

## 4. 사용자 선호사항

- **한국어로** 응답
- 짧고 명확하게, 필요 시에만 길게
- 코드 변경 후 항상 `npm run build` 검증
- 큰 변화는 제안 → 승인 받고 진행
- 커밋 메시지는 영어로, 본문에 한국어 가능
- main push 후 `DEVLOG.md` 업데이트 (DEVLOG 자체 갱신 push는 예외)

## 5. 알려진 도메인 함정

- 닉네임 변경 직후 넥슨 API 조회 실패 → 반영 대기 안내 필요
- `spid` = 시즌ID(앞 3자리) + 선수 고유 `pid`(뒤 6자리). 같은 실존 선수의 모든 시즌 카드는 pid 공유
- 공식 API에 **시세(BP 가격) 없음** — 가격 기능은 v1 제외
- `matchResult`는 "승"/"무"/"패" **한글 문자열**
- `ballPossesionTry` 등 오타가 공식 스펙 — 그대로 사용
- 몰수/비정상 종료는 `matchEndType`(0 정상/1 몰수승/2 몰수패)으로 판별
