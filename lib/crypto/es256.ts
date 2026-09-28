/**
 * ES256(ECDSA P-256) JWT 서명 — WebCrypto 만 쓴다.
 *
 * APNs 푸시와 Sign in with Apple 토큰 폐기가 똑같이 .p8 키로 ES256 JWT 를 만든다.
 * 예전엔 둘 다 `node:crypto`(createSign) 를 썼는데, Cloudflare Workers 로 옮기며
 * WebCrypto 로 통일했다(2026-09-28). WebCrypto 의 ECDSA 서명은 이미 raw r||s(64바이트)라
 * JOSE 가 요구하는 형식 그대로다 — node 쪽에서 하던 DER 변환·dsaEncoding 지정이 필요 없다.
 */

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64urlJson = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** .p8(PKCS#8 PEM) → WebCrypto ECDSA P-256 개인키 */
export async function importP8(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/** header·payload 를 ES256 으로 서명한 JWT 문자열 */
export async function es256Jwt(header: object, payload: object, pem: string): Promise<string> {
  const unsigned = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const key = await importP8(pem);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${b64url(sig)}`;
}
