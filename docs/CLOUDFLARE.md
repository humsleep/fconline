# Cloudflare 앞단 세우기 — Vercel 무료 한도 복구·재발 방지

> 2026-09-28 Vercel Hobby 한도 초과로 계정 전체(fconline + my-blog-tool)가 멈춘 뒤 작성.
> 처음 하는 사람이 순서대로 따라 할 수 있게 적었다. 클릭 경로는 Cloudflare 대시보드 2026-09 기준.

## 0. 왜 "전체 이전"이 아니라 "앞에 세우기"인가

Cloudflare Workers 로 Next.js 를 통째로 옮기는 것도 가능하지만, 지금 상황에는 과하다.

| | 앞에 세우기(권장) | 전체 이전 |
|---|---|---|
| 걸리는 시간 | 1~2시간(대부분 대기) | 1~2일 |
| 코드 변경 | 없음 | 빌드·캐시·크론 전부 손봐야 함 |
| 되돌리기 | 네임서버만 되돌리면 끝 | 어려움 |
| 초과 항목 해결 | 셋 다 해결 | 셋 다 해결 |
| 위험 | 낮음 | 심사 중에 장애 나면 치명적 |

Cloudflare 무료 플랜은 **대역폭 제한이 없고**, 캐시된 요청은 Vercel 에 **아예 도달하지 않는다**.
즉 Vercel 사용량이 줄어드는 게 아니라 **애초에 발생하지 않는다.**

## 1. 무엇이 한도를 넘겼나 (2026-09-28 기준)

| 항목 | 사용/한도 | 원인 |
|---|---|---|
| 🔴 Fluid Active CPU | 11h 31m / 4h | 아래 두 항목의 결과 — 함수가 너무 자주 돈다 |
| 🔴 Fast Origin Transfer | 19.49 GB / 10 GB | **선수 이미지 프록시**. 전적 화면 1회 = 0.9~1.3MB |
| 🔴 Function Invocations | 1M / 1M | 이미지 1장 = 함수 1회. 캐시 미스가 전부 함수를 깨움 |
| 🟡 Edge Requests | 887K / 1M | — |
| 🟢 Fast Data Transfer | 12.78 GB / 100 GB | 여유 |

- 지역 통계에서 **iad1(미국) 96.3%** → 실제 유저가 아니라 **크롤러·봇**이 대부분이다.
- `/api/player-image/[spid]` 는 넥슨 CDN 을 대신 받아 오는 프록시다. 이미지는 **절대 안 바뀌는데**
  캐시가 7일이라 계속 원본을 다시 받아 왔다.
- **사용량은 프로젝트가 아니라 계정 단위다.** 그래서 블로그(bohemebloglab.com)도 같이 멈췄다.
  블로그 도메인에도 같은 작업을 해 두는 게 좋다.

## 2. 순서 (fcscope.xyz 기준, 블로그는 같은 방법 반복)

### 1단계 — Cloudflare 에 도메인 등록 (10분 + 대기)

1. https://dash.cloudflare.com 가입(무료). 카드 등록 요구 없음.
2. **Add a domain** → `fcscope.xyz` 입력 → **Free** 플랜 선택.
3. Cloudflare 가 가비아의 기존 DNS 레코드를 자동으로 읽어 온다.
   **읽어 온 목록에 아래가 다 있는지 눈으로 확인한다.** 하나라도 빠지면 그 기능이 죽는다.
   - `www` (Vercel 로 가는 CNAME `...vercel-dns-017.com`)
   - 루트 `fcscope.xyz` (A 레코드 216.198.79.65 등)
   - 메일·인증용 TXT/MX 레코드가 있다면 그것도
   빠진 게 있으면 가비아 DNS 화면과 대조해 **직접 추가**한다.
4. `www` 와 루트 레코드의 **구름 아이콘을 주황색(Proxied)** 으로 만든다. 회색이면 Cloudflare 를 그냥 통과해서 아무 효과가 없다.
5. Cloudflare 가 알려 주는 **네임서버 2개**(예: `xxx.ns.cloudflare.com`)를 적어 둔다.
6. **가비아** → My가비아 → 도메인 → 해당 도메인 → **네임서버 설정** → 1차·2차에 위 두 개를 넣고 저장.
7. 여기서 **기다린다.** 보통 10분~2시간, 최대 24시간. Cloudflare 대시보드 상태가 **Active** 로 바뀌면 끝이다.

> ⚠️ 이 단계에서 서비스가 잠깐 끊길 수 있다. 어차피 지금 Vercel 이 멈춰 있어 손해가 없으니 오히려 지금이 적기다.

### 2단계 — SSL 설정 (2분, 안 하면 무한 리디렉션)

1. 좌측 **SSL/TLS** → **Overview** → 암호화 모드를 **Full (strict)** 로.
   - ❌ Flexible 로 두면 "리디렉션이 너무 많습니다" 오류가 난다. 가장 흔한 실수다.
2. **Edge Certificates** → **Always Use HTTPS** 켜기.

### 3단계 — 캐시 규칙 3개 (10분, 여기가 핵심)

좌측 **Caching** → **Cache Rules** → **Create rule** 로 아래 셋을 만든다.
각 규칙에서 **Cache eligibility = Eligible for cache**, **Edge TTL = Ignore cache-control header and use this TTL** 로 설정한다.

| 이름 | 조건(Field: URI Path) | Edge TTL | Browser TTL |
|---|---|---|---|
| `player-images` | `starts with` `/api/player-image/` | **1 year** | 1 day |
| `season-images` | `starts with` `/api/season-image/` | **1 year** | 1 day |
| `share-cards` | `starts with` `/api/card/` | **1 month** | 1 day |

이미지는 내용이 절대 안 바뀌므로 1년이 안전하다. 새 시즌 카드가 나와도 **주소(spid)가 새로 생기는 것**이라
기존 주소의 내용이 바뀌지 않는다.

> 넣지 말 것: `/api/v1/`, `/api/community/`, `/api/me/`, `/auth/` — 로그인·글쓰기가 깨진다.

### 4단계 — 봇 차단 (5분)

1. 좌측 **Security** → **Bots** → **Bot Fight Mode** 켜기(무료).
2. 같은 화면의 **AI Scrapers and Crawlers → Block** 켜기(무료). 미국발 크롤러 트래픽이 여기서 잘린다.
3. 좌측 **Security** → **WAF** → **Rate limiting rules** → Create:
   - 조건: URI Path `starts with` `/api/`
   - 같은 IP 가 **1분에 60회** 넘으면 → **Block**, 10분간.
   - 무료 플랜은 규칙 1개까지 만들 수 있다.

> 구글·네이버 검색 봇은 위 설정에 걸리지 않는다(Verified Bot 으로 통과). 검색 노출은 유지된다.

### 5단계 — 확인

터미널에서:

```bash
curl -sI https://www.fcscope.xyz/api/player-image/300220683 | grep -iE "cf-cache-status|server|cache-control"
```

- `cf-cache-status: MISS` → 첫 요청(정상). 같은 명령을 한 번 더 실행해 **`HIT`** 이 나오면 성공이다.
- `HIT` 인 요청은 Vercel 에 도달하지 않는다 = 사용량 0.

## 3. Vercel 은 언제 다시 살아나나

Hobby 사용량은 **결제 주기마다 초기화**된다. Vercel → 좌측 하단 계정 → **Usage** 페이지 상단의
기간 표시(예: `Aug 29 - Sep 28`)가 주기다. 초기화되면 자동으로 재개된다.
그때 Cloudflare 가 앞에 서 있으면 같은 일이 반복되지 않는다.

## 4. 되돌리는 법

가비아 네임서버를 원래(`ns.gabia.co.kr` 등)로 되돌리면 끝이다. Vercel 설정은 건드리지 않았으므로 그대로 동작한다.

## 5. 이것으로도 부족하면 (다음 단계)

이미지 프록시 자체를 Cloudflare Worker 로 옮긴다. 그러면 캐시가 비어 있을 때조차 Vercel 을 안 거친다.
도메인을 포기하게 될 경우의 대비(앱 API 주소 이전)와 함께 진행하는 게 좋다 — `DEVLOG.md` 2026-09-22 항목 참고.
