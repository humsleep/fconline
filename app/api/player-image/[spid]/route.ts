const CDN = 'https://fco.dn.nexoncdn.co.kr/live/externalAssets/common';

// 넥슨 CDN은 브라우저 직접 로드 시 CORS 이슈 → 서버 프록시.
// 폴백 체인: 액션샷(spid) → 기본 이미지(pid, spid 뒤 6자리) → 실루엣 SVG
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spid: string }> }
) {
  const { spid } = await params;

  if (!/^\d{1,9}$/.test(spid)) {
    return new Response('invalid spid', { status: 400 });
  }

  const pid = Number(spid) % 1_000_000;
  const candidates = [
    `${CDN}/playersAction/p${spid}.png`,
    `${CDN}/players/p${pid}.png`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { next: { revalidate: 604800 } });
      if (res.ok) {
        return new Response(res.body, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          },
        });
      }
    } catch {
      // 다음 후보로
    }
  }

  return new Response(SILHOUETTE, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

const SILHOUETTE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="none"/>
  <circle cx="48" cy="34" r="16" fill="#223042"/>
  <path d="M16 88c0-18 14-28 32-28s32 10 32 28" fill="#223042"/>
</svg>`;
