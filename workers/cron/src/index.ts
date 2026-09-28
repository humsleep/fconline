/**
 * 크론 트리거 → 본체의 /api/cron/* 호출.
 *
 * 크론 라우트는 fail-closed 다(CRON_SECRET 미설정이면 401). 시크릿은 양쪽에 같은 값이어야 한다:
 *   npx wrangler secret put CRON_SECRET            (본체 fcscope)
 *   npx wrangler secret put CRON_SECRET -c workers/cron/wrangler.jsonc
 */
// Workers 런타임 타입(이 폴더는 Next 의 tsconfig 에서 제외돼 있다 — 최소 선언만 둔다).
interface ScheduledController {
  cron: string;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface Env {
  SITE_ORIGIN: string;
  CRON_SECRET: string;
}

// wrangler.jsonc 의 crons 와 1:1. cron 표현식으로 어떤 작업인지 가른다.
// Cloudflare 가 표현식을 되돌려줄 때 표기(SUN vs 0 vs 7, 대소문자)가 달라질 수 있어 별칭을 함께 둔다.
const ROUTES: Record<string, string> = {
  '0 18 * * *': '/api/cron/ranker-snapshot',
  '0 12 * * sun': '/api/cron/push-weekly',
  '0 12 * * 0': '/api/cron/push-weekly',
  '0 12 * * 7': '/api/cron/push-weekly',
  '0 9 * * fri': '/api/cron/push-meta',
  '0 9 * * 5': '/api/cron/push-meta',
};

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const path = ROUTES[event.cron.trim().toLowerCase()];
    if (!path) {
      console.error(`unknown cron: ${event.cron}`);
      return;
    }
    ctx.waitUntil(
      (async () => {
        const url = `${env.SITE_ORIGIN}${path}`;
        try {
          const res = await fetch(url, {
            headers: { authorization: `Bearer ${env.CRON_SECRET}` },
          });
          const body = await res.text();
          console.log(`${path} → ${res.status} ${body.slice(0, 500)}`);
        } catch (e) {
          console.error(`${path} → ${e instanceof Error ? e.message : String(e)}`);
        }
      })()
    );
  },
};
