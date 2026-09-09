import 'server-only';
import http2 from 'node:http2';
import { createPrivateKey, createSign } from 'node:crypto';

/**
 * APNs HTTP/2 발송 (토큰 기반 인증, .p8). 외부 의존성 없이 Node http2 + crypto 로 구현.
 * env: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY(.p8 내용, \n 은 실제 개행 또는 "\\n"), APNS_BUNDLE_ID(기본 xyz.fcscope.app), APNS_SANDBOX=1(개발)
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
    host: process.env.APNS_SANDBOX ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com',
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

export interface PushResult {
  token: string;
  status: number;
  reason?: string;
}

/** 여러 토큰에 같은 페이로드 발송. 410/400(BadDeviceToken·Unregistered)은 호출부가 토큰을 지운다. */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<PushResult[]> {
  const c = config();
  if (!c || tokens.length === 0) return [];
  const client = http2.connect(c.host);
  const jwt = providerToken(c);
  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: 'default', ...(payload.badge !== undefined ? { badge: payload.badge } : {}) },
    ...(payload.link ? { link: payload.link } : {}),
  });
  const results: PushResult[] = [];
  try {
    for (const token of tokens) {
      const res = await new Promise<PushResult>((resolve) => {
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${token}`,
          authorization: `bearer ${jwt}`,
          'apns-topic': c.bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          ...(payload.collapseId ? { 'apns-collapse-id': payload.collapseId } : {}),
          'content-type': 'application/json',
        });
        let status = 0;
        let data = '';
        req.on('response', (h) => { status = Number(h[':status'] ?? 0); });
        req.on('data', (d) => { data += d; });
        req.on('end', () => {
          let reason: string | undefined;
          try { reason = JSON.parse(data).reason; } catch { /* empty */ }
          resolve({ token, status, reason });
        });
        req.on('error', () => resolve({ token, status: 0, reason: 'network' }));
        req.setTimeout(10_000, () => { req.close(); resolve({ token, status: 0, reason: 'timeout' }); });
        req.end(body);
      });
      results.push(res);
    }
  } finally {
    client.close();
  }
  return results;
}

/** 무효 토큰 판별(삭제 대상) */
export function isDeadToken(r: PushResult): boolean {
  return r.status === 410 || (r.status === 400 && (r.reason === 'BadDeviceToken' || r.reason === 'DeviceTokenNotForTopic'));
}
