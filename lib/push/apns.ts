import 'server-only';
import { es256Jwt } from '@/lib/crypto/es256';
import { apnsHost, type PushResult } from './policy';

export { isDeadToken, type PushResult } from './policy';

/**
 * APNs 발송 (토큰 기반 인증, .p8). 외부 의존성 없이 fetch + WebCrypto 로 구현.
 *
 * 2026-09-28 이전에는 `node:http2` 를 직접 썼다. Cloudflare Workers 에는 그 모듈이 없어서
 * 호스팅을 옮기며 재작성했다. APNs 는 HTTP/2 만 받는데, **Workers 의 fetch 는 HTTP/2 로 나간다**.
 * 반대로 로컬 Node 에서는 fetch 가 HTTP/1.1 이라 APNs 가 거절한다 —
 * 즉 이 함수는 배포된 Worker 에서만 실제로 동작한다(로컬 크론 테스트는 401/000 이 정상).
 *
 * env: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY(.p8 내용, \n 은 실제 개행 또는 "\\n"),
 *      APNS_BUNDLE_ID(기본 xyz.fcscope.app), APNS_SANDBOX=1|true(개발 — 그 외·미설정은 운영)
 */
export interface PushPayload {
  title: string;
  body: string;
  link?: string; // 앱 딥링크(https://www.fcscope.xyz/...)
  badge?: number;
  collapseId?: string;
}

function config() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const raw = process.env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !raw) return null;
  return {
    keyId,
    teamId,
    key: raw.replace(/\\n/g, '\n'),
    bundleId: process.env.APNS_BUNDLE_ID ?? 'xyz.fcscope.app',
    host: apnsHost(process.env.APNS_SANDBOX),
  };
}

export function apnsConfigured(): boolean {
  return config() !== null;
}

let cachedJwt: { token: string; at: number } | null = null;

/**
 * ES256 JWT — 50분 캐시(애플 권장: 20분~1시간 재사용).
 * 서명은 `lib/crypto/es256.ts` 공용 모듈(WebCrypto).
 */
async function providerToken(c: NonNullable<ReturnType<typeof config>>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.at < 50 * 60) return cachedJwt.token;
  const token = await es256Jwt({ alg: 'ES256', kid: c.keyId }, { iss: c.teamId, iat: now }, c.key);
  cachedJwt = { token, at: now };
  return token;
}

/** 동시 발송 수. APNs 는 넉넉히 받지만 Worker 의 동시 연결을 고려해 보수적으로. */
const CONCURRENCY = 10;
const REQUEST_TIMEOUT_MS = 10_000;

function parseReason(data: string): string | undefined {
  try {
    return JSON.parse(data).reason;
  } catch {
    return undefined;
  }
}

/**
 * 여러 토큰에 같은 페이로드 발송. 410/400(BadDeviceToken 등)은 호출부가 토큰을 지운다.
 *
 * 절대 throw 하지 않는다. 네트워크 오류·타임아웃은 status 0 으로 보고하며,
 * status 0 은 APNs 판정이 아니므로 토큰 삭제 대상이 되지 않는다(`policy.isDeadToken`).
 */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<PushResult[]> {
  const c = config();
  if (!c || tokens.length === 0) return [];

  let jwt: string;
  try {
    jwt = await providerToken(c);
  } catch {
    // 키 형식 오류 등 — 한 건도 보내지 않는다(토큰은 그대로 보존).
    return tokens.map((token) => ({ token, status: 0, reason: 'jwt' }));
  }

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    },
    ...(payload.link ? { link: payload.link } : {}),
  });

  const headers: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    'apns-topic': c.bundleId,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'content-type': 'application/json',
    ...(payload.collapseId ? { 'apns-collapse-id': payload.collapseId } : {}),
  };

  const sendOne = async (token: string): Promise<PushResult> => {
    try {
      const res = await fetch(`${c.host}/3/device/${token}`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return { token, status: res.status };
      const text = await res.text().catch(() => '');
      return { token, status: res.status, reason: parseReason(text) };
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      return { token, status: 0, reason: name === 'TimeoutError' ? 'timeout' : 'network' };
    }
  };

  const results: PushResult[] = new Array(tokens.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= tokens.length) return;
      results[i] = await sendOne(tokens[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tokens.length) }, worker));
  return results;
}
