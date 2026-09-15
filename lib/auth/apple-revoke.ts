import { createPrivateKey, createSign } from 'node:crypto';

/**
 * Sign in with Apple 토큰 폐기 — App Store 5.1.1(v): Apple 로그인을 제공하는 앱은 계정 삭제 시
 * Apple REST API 로 사용자 토큰을 폐기해야 한다(2022-06 부터). Supabase deleteUser 는 이를 하지 않는다.
 *
 * 흐름: 앱이 삭제 직전 Apple 재인증으로 받은 authorizationCode(5분·1회용)를 넘긴다 →
 *   /auth/token 으로 refresh_token 교환 → /auth/revoke.
 * 키가 없거나(미설정) Apple 이 실패해도 **계정 삭제는 막지 않는다** — 삭제권이 우선이다.
 *
 * env: APPLE_TEAM_ID(유니버설 링크와 공용), APPLE_SIWA_KEY_ID, APPLE_SIWA_PRIVATE_KEY(.p8 내용, "\n" 이스케이프 허용),
 *      APPLE_SIWA_CLIENT_ID(선택, 기본 번들 ID — 앱의 네이티브 Apple 로그인은 번들 ID 가 client_id).
 */

export interface AppleSiwaConfig {
  teamId: string;
  keyId: string;
  key: string;
  clientId: string;
}

export type AppleRevokeResult = 'revoked' | 'not_configured' | 'failed';

const APPLE = 'https://appleid.apple.com';
const TIMEOUT_MS = 5_000;

export function appleSiwaConfig(env: Record<string, string | undefined> = process.env): AppleSiwaConfig | null {
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_SIWA_KEY_ID?.trim();
  const key = env.APPLE_SIWA_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!teamId || !keyId || !key) return null;
  const clientId = env.APPLE_SIWA_CLIENT_ID?.trim() || env.NEXT_PUBLIC_IOS_BUNDLE_ID?.trim() || 'xyz.fcscope.app';
  return { teamId, keyId, key, clientId };
}

/** client_secret — ES256 JWT, 5분 유효(Apple 상한 6개월이지만 요청마다 새로 만든다). */
export function buildAppleClientSecret(c: AppleSiwaConfig, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'ES256', kid: c.keyId })}.${b64({ iss: c.teamId, iat, exp: iat + 300, aud: APPLE, sub: c.clientId })}`;
  const signer = createSign('SHA256');
  signer.update(unsigned);
  // JOSE 는 DER 이 아니라 r||s 64바이트 — ieee-p1363 으로 바로 받는다.
  const sig = signer.sign({ key: createPrivateKey(c.key), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${unsigned}.${sig}`;
}

async function postForm(path: string, form: Record<string, string>): Promise<Response> {
  return fetch(`${APPLE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
}

export async function revokeAppleAuthorization(
  authorizationCode: string,
  config: AppleSiwaConfig | null = appleSiwaConfig()
): Promise<AppleRevokeResult> {
  if (!config) return 'not_configured';
  try {
    const client_secret = buildAppleClientSecret(config);
    const tokenRes = await postForm('/auth/token', {
      client_id: config.clientId,
      client_secret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
    if (!tokenRes.ok) return 'failed';
    const t = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
    const token = t.refresh_token ?? t.access_token;
    if (!token) return 'failed';
    const revokeRes = await postForm('/auth/revoke', {
      client_id: config.clientId,
      client_secret,
      token,
      token_type_hint: t.refresh_token ? 'refresh_token' : 'access_token',
    });
    return revokeRes.ok ? 'revoked' : 'failed';
  } catch {
    return 'failed';
  }
}
