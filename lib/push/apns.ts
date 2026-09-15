import 'server-only';
import http2 from 'node:http2';
import { createPrivateKey, createSign } from 'node:crypto';
import { apnsHost, type PushResult } from './policy';

export { isDeadToken, type PushResult } from './policy';

/**
 * APNs HTTP/2 발송 (토큰 기반 인증, .p8). 외부 의존성 없이 Node http2 + crypto 로 구현.
 * env: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY(.p8 내용, \n 은 실제 개행 또는 "\\n"), APNS_BUNDLE_ID(기본 xyz.fcscope.app),
 *      APNS_SANDBOX=1|true(개발 — 그 외 값·미설정은 운영)
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

/** ES256 JWT — 50분 캐시(애플 권장: 20분~1시간 재사용) */
function providerToken(c: NonNullable<ReturnType<typeof config>>): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.at < 50 * 60) return cachedJwt.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'ES256', kid: c.keyId })}.${b64({ iss: c.teamId, iat: now })}`;
  const signer = createSign('SHA256');
  signer.update(unsigned);
  const der = signer.sign(createPrivateKey(c.key));
  // DER(r,s) → raw 64바이트(JOSE)
  const r = der.subarray(4, 4 + der[3]);
  const s = der.subarray(6 + der[3]);
  const pad = (b: Buffer) => (b.length > 32 ? b.subarray(b.length - 32) : Buffer.concat([Buffer.alloc(32 - b.length), b]));
  const sig = Buffer.concat([pad(r), pad(s)]).toString('base64url');
  const token = `${unsigned}.${sig}`;
  cachedJwt = { token, at: now };
  return token;
}

/** 한 세션에서 동시에 여는 스트림 수. APNs 는 연결당 수백 스트림을 허용하지만 보수적으로. */
const CONCURRENCY = 10;
const STREAM_TIMEOUT_MS = 10_000;

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
 * 절대 throw·hang 하지 않는다: 세션 오류(error)는 진행 중 스트림을 status 0 으로 끝내고,
 * GOAWAY 는 새 스트림만 멈춘다(이미 보낸 스트림은 응답을 받는다). 남은 토큰은 status 0.
 * status 0 은 무효 토큰이 아니므로 삭제되지 않는다. 세션은 항상 닫는다.
 */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<PushResult[]> {
  const c = config();
  if (!c || tokens.length === 0) return [];
  const jwt = providerToken(c); // 키 오류는 연결을 열기 전에 터지게(세션 누수 방지)
  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: 'default', ...(payload.badge !== undefined ? { badge: payload.badge } : {}) },
    ...(payload.link ? { link: payload.link } : {}),
  });

  let client: http2.ClientHttp2Session;
  try {
    client = http2.connect(c.host);
  } catch {
    return tokens.map((token) => ({ token, status: 0, reason: 'connect' }));
  }

  let stopReason: string | null = null;
  const inflight = new Set<(reason: string) => void>();
  client.on('error', () => {
    stopReason ??= 'session_error';
    for (const abort of [...inflight]) abort('session_error');
  });
  client.on('goaway', () => {
    stopReason ??= 'goaway';
  });

  const sendOne = (token: string) =>
    new Promise<PushResult>((resolve) => {
      let settled = false;
      let status = 0;
      let data = '';
      let req: http2.ClientHttp2Stream | null = null;
      const done = (r: PushResult) => {
        if (settled) return;
        settled = true;
        inflight.delete(abort);
        resolve(r);
      };
      const abort = (reason: string) => {
        done({ token, status: 0, reason });
        try {
          req?.close(http2.constants.NGHTTP2_CANCEL);
        } catch {
          /* 이미 닫힘 */
        }
      };
      inflight.add(abort);
      try {
        req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${token}`,
          authorization: `bearer ${jwt}`,
          'apns-topic': c.bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          ...(payload.collapseId ? { 'apns-collapse-id': payload.collapseId } : {}),
          'content-type': 'application/json',
        });
      } catch {
        done({ token, status: 0, reason: 'session_closed' });
        return;
      }
      req.setEncoding('utf8');
      req.on('response', (h) => {
        status = Number(h[':status'] ?? 0);
      });
      req.on('data', (d: string) => {
        data += d;
      });
      req.on('end', () => done({ token, status, reason: parseReason(data) }));
      req.on('close', () => done(status ? { token, status, reason: parseReason(data) } : { token, status: 0, reason: 'closed' }));
      req.on('error', () => done({ token, status: 0, reason: 'network' }));
      req.setTimeout(STREAM_TIMEOUT_MS, () => abort('timeout'));
      req.end(body);
    });

  const results: PushResult[] = new Array(tokens.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= tokens.length) return;
      if (stopReason || client.closed || client.destroyed) {
        results[i] = { token: tokens[i], status: 0, reason: stopReason ?? 'session_closed' };
        continue;
      }
      results[i] = await sendOne(tokens[i]);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tokens.length) }, worker));
  } finally {
    try {
      if (stopReason === 'session_error') client.destroy();
      else client.close();
    } catch {
      /* 이미 닫힘 */
    }
  }
  return results;
}
