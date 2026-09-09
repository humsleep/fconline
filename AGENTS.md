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
- **저장소**: https://github.com/humsleep/fconline (웹) — **iOS 앱은 별도 저장소**(`fcscope-ios`)
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
- **match-detail은 불변 데이터** → matchId 기준 영구 캐시 (Supabase `match_cache`)
  - payload는 **배열 패킹**해서 저장한다(`lib/nexon/pack.ts`). JSON 키 이름이 용량의 74%였다.
    `unpackMatchDetail`이 구 저장분(객체)도 읽으므로 마이그레이션은 필요 없다.
  - **크롤러 요청은 캐시 전용**(`cacheOnly`) — 크롤 1회당 넥슨 30콜 + 쓰기가 0이 된다.
    공유 카드 라우트도 동일(링크 미리보기 봇이 반복 요청하므로).
- **넥슨 API 레이트리밋 대응** — 무제한 병렬 금지. **인스턴스당 동시 3 상한**(`lib/nexon/semaphore.ts`).
  과거 "순차 큐잉"이던 것을 2026-09-05 라이브 실측으로 조정했다: 실제 30경기 워크로드에서
  동시 1은 약 9,000ms, **동시 3은 2,883ms이고 비200 응답 0건**. 429를 한 번이라도 보면
  해당 인스턴스는 남은 수명 동안 동시 1로 강등된다(자동 복귀 없음 — 되돌리면 진동한다).
  상한을 더 올리려면 반드시 실측부터 할 것.
- **선수 이미지는 CORS 이슈** → 웹은 Next.js 이미지 프록시 경유.
  단 **네이티브 앱에는 CORS가 없어** 넥슨 CDN을 직접 부른다(iOS 저장소 `FCScope/Core/API/NexonCDN.swift`). 프록시 대역폭 0.
- **iOS 앱은 별도 저장소**(https://github.com/humsleep/fcscope, SwiftUI). 이 저장소는 앱의 **백엔드**만
  담당한다 — `app/api/v1/*`, `lib/api/v1.ts`, `lib/push/*`(APNs), `app/api/me/delete/`,
  `app/.well-known/apple-app-site-association/`, `app/app-ads.txt/`.
  `lib/supabase/server.ts` 가 쿠키(웹)와 Bearer JWT(앱)를 함께 받는다.
  **웹 코드에 앱 전용 분기를 다시 넣지 말 것** — Capacitor 웹뷰 셸 시절의 `data-native` 분기는 전부 제거했다.
- 🔴 **`/api/v1` 은 깨뜨릴 수 없는 공개 계약이다 — 필드 추가만 허용.**
  앱은 12개 v1 라우트를 `Models.swift`(420줄)로 그대로 디코딩하며 **버전 협상이 없다**.
  앱스토어에 나간 구버전은 몇 달씩 살아 있고 심사 때문에 즉시 고칠 수도 없어서,
  **필드 삭제·개명·타입 변경은 그 순간 배포된 앱을 깨뜨린다**.
  - 없앨 필드는 지우지 말고 `null` 로 계속 내려보낸다(앱 모델이 옵셔널이면 안 깨진다).
  - 필수(non-null)였던 필드를 nullable 로 바꾸는 것도 파괴적 변경이다.
  - 정말 깨야 하면 `/api/v2` 를 새로 만들고 v1 은 남긴다.
  - 리팩터링·죽은 코드 정리 중 v1 응답 형태를 건드리려 할 때 이 항목부터 확인할 것.
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
- 🔴 `user/trade`(이적시장 거래 기록)는 **`ouid` 파라미터를 무시**하고 API 키 소유자 본인 거래만 반환한다
  (2026-09-04 라이브 실측: 존재하지 않는 ouid 로도 200 + 동일 응답). 타인 전적에 붙이는 기능은 성립하지 않아
  이적시장 기능 전체를 제거했다. 되살리려는 시도 전에 이 제약부터 재확인할 것.
- 화폐개혁(2026-08-20, 옛 1억 BP = 새 1 BP): 넥슨은 **거래 시점 단위로 값을 보관**한다.
  과거 데이터를 다시 다루게 되면 거래일 기준으로만 환산할 것(전량 환산은 개혁 후 값을 1억배 축소시킴).
- `matchResult`는 "승"/"무"/"패" **한글 문자열**
- `ballPossesionTry` 등 오타가 공식 스펙 — 그대로 사용
- 몰수/비정상 종료는 `matchEndType`(0 정상/1 몰수승/2 몰수패)으로 판별
