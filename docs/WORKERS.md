# Cloudflare Workers 배포 — 순서대로 따라 하기

> 2026-09-28. Vercel Hobby 가 한도 초과로 멈췄고(계정 전체 402), **Hobby 는 상업적 사용이 금지**라
> 광고 수익이 있는 앱의 백엔드로는 애초에 맞지 않았다. Workers 무료 플랜은 상업적 사용이 허용되고
> 대역폭 제한이 없다. 배경과 사고 경위는 `docs/CLOUDFLARE.md`.

## 준비된 것 (코드 쪽은 끝)

| 항목 | 내용 |
|---|---|
| 어댑터 | `@opennextjs/cloudflare` + `wrangler` (devDependencies) |
| 설정 | `wrangler.jsonc`, `open-next.config.ts`, `public/_headers` |
| Next.js | **16.2.10 → 16.3.6 업그레이드**(어댑터가 16.3.3 이상만 지원) |
| 푸시 | `lib/push/apns.ts` 를 `node:http2` → `fetch` + WebCrypto 로 재작성 |
| 크론 | `workers/cron/` 별도 워커 (Vercel Cron 3개를 Cron Triggers 로) |
| 제거 | `@vercel/analytics` |
| 검증 | 로컬 Workers 런타임(`workerd`)에서 페이지·이미지·프록시 정상 확인 |

## 1. 로그인 + KV 만들기

```bash
npx wrangler login
```

```bash
npx wrangler kv namespace create NEXT_INC_CACHE_KV
```

출력에 `id = "abc123..."` 이 나온다. 그 값을 `wrangler.jsonc` 의 `PLACEHOLDER_KV_ID` 자리에 붙여넣는다.
(ISR·데이터 캐시 저장소다. 무료 플랜에 포함되며, 없으면 매 요청이 오리진 계산이 된다.)

## 2. 빌드 시점 환경변수 (`.env.local`)

`NEXT_PUBLIC_*` 값은 **빌드할 때 코드에 박힌다.** 런타임 시크릿으로 넣으면 반영되지 않는다.
Vercel → Settings → Environment Variables 에서 값을 복사해 프로젝트 루트에 `.env.local` 로 만든다.

```
NEXT_PUBLIC_SITE_URL=https://www.fcscope.xyz
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_DEMO_NICKNAME=보엠
NEXT_PUBLIC_IOS_BUNDLE_ID=xyz.fcscope.app
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...
NEXT_PUBLIC_NAVER_SITE_VERIFICATION=...
NEXT_PUBLIC_GA_ID=...
```

## 3. 런타임 시크릿 (서버 전용)

하나씩 물어보는 대화형이다. 값을 붙여넣고 엔터.

```bash
for k in SUPABASE_SERVICE_ROLE_KEY NEXON_API_KEY ADMIN_EMAILS IP_HASH_SALT CRON_SECRET ADMOB_PUBLISHER_ID APPLE_TEAM_ID APPLE_SIWA_KEY_ID APPLE_SIWA_PRIVATE_KEY APNS_KEY_ID APNS_TEAM_ID APNS_PRIVATE_KEY APNS_BUNDLE_ID; do npx wrangler secret put $k; done
```

`APNS_PRIVATE_KEY` 처럼 여러 줄인 값은 개행을 `\n` 으로 바꾼 **한 줄**로 넣는다(코드가 되돌린다).

## 4. 배포

```bash
npm run deploy
```

끝나면 `https://fcscope.<계정>.workers.dev` 주소가 나온다. **도메인을 옮기기 전에 여기서 먼저 확인한다.**
홈 검색(`보엠`), 전적 화면, 커뮤니티, 로그인, 공유 카드까지 눌러 본다.

## 5. 도메인 연결 (여기서 실제 전환)

Cloudflare 대시보드 → **Workers & Pages** → `fcscope` → **Settings** → **Domains & Routes** → **Add custom domain**

- `www.fcscope.xyz`
- `fcscope.xyz`

추가하면 Cloudflare 가 DNS 를 자동으로 바꾼다(기존 Vercel A/CNAME 레코드는 대체된다).
전환은 1분 안에 끝난다.

## 6. 크론 워커 배포

```bash
npx wrangler deploy -c workers/cron/wrangler.jsonc
```

```bash
npx wrangler secret put CRON_SECRET -c workers/cron/wrangler.jsonc
```

본체와 **같은 값**이어야 한다(크론 라우트가 `Bearer` 로 검사한다).
동작 확인은 대시보드 → `fcscope-cron` → Settings → Trigger Events → **Cron Triggers** 에서 수동 실행.

## 7. 확인

```bash
curl -sI https://www.fcscope.xyz/ | grep -iE "^HTTP|^server|^cf-cache-status"
```

- 로그인 → 글쓰기 → 계정 삭제까지 한 번 돌려 본다(심사 영상과 같은 경로).
- iOS 앱에서 전적 조회 → 앱이 쓰는 `/api/v1/*` 가 정상인지 본다.
- `npm run verify:api` 로 v1 계약을 실제 서버와 대조한다.

## 되돌리는 법

Workers 의 Custom domain 을 지우고, DNS 에 원래 레코드를 되살린다.

| 이름 | 종류 | 값 |
|---|---|---|
| `www` | CNAME | `fdc7edf15e22cbc7.vercel-dns-017.com` |
| `fcscope.xyz` | A | `216.198.79.1` |

Vercel 프로젝트는 지우지 않고 남겨 둔다(2026-10-22~24 경 사용량 창이 지나면 다시 살아난다).

## 알아 둘 제약

| | 무료 | 유료 $5/월 |
|---|---|---|
| 요청 | 10만/일 | 1천만/월 |
| **요청당 CPU** | **10ms** | 30초 |
| **요청당 외부 호출** | **50개** | 1,000개 |

무료로 시작한다. 걸리면 **대시보드에서 클릭 한 번으로 유료 전환**이며 코드 변경은 없다.
지켜볼 신호 두 가지:

1. Workers → Observability 에서 **`exceededCpu`(1102)** 오류 — CPU 10ms 초과.
2. `/user/[nickname]` 500 — 이 페이지는 넥슨 API 를 최대 36번 부른다(외부 호출 50개 한도에 근접).

둘 중 하나라도 보이면 유료로 올린다.
