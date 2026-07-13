# DEVLOG

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
