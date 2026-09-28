import { isBot } from '@/lib/security/bot';

const CDN = 'https://fco.dn.nexoncdn.co.kr/live/externalAssets/common';

// 넥슨 CDN은 브라우저 직접 로드 시 CORS 이슈 → 서버 프록시.
// 폴백 체인: 액션샷(spid) → 기본 이미지(pid, spid 뒤 6자리) → 실루엣 SVG
export async function GET(
  req: Request,
  { params }: { params: Promise<{ spid: string }> }
) {
  // 2026-09-28: 이 라우트가 Vercel Hobby 한도를 넘긴 주범이었다(오리진 19.5GB/10GB,
  // 함수 호출 1M/1M). sitemap 이 선수 페이지 8,000개를 광고하므로 크롤 1패스마다
  // 이미지 수천 장을 넥슨에서 다시 받아 왔다. 봇에겐 넥슨을 부르지 않고 바로 끊는다.
  // (사람 UA 로 위장한 봇은 Cloudflare 가 막는다 — docs/CLOUDFLARE.md)
  if (isBot(req.headers.get('user-agent'))) {
    return new Response(null, {
      status: 403,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  }

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
      const res = await fetch(url, { next: { revalidate: 31536000 } });
      if (res.ok) {
        return new Response(res.body, {
          headers: {
            'Content-Type': 'image/png',
            // 이미지는 내용이 바뀌지 않는다(새 카드는 새 spid). 1년 + immutable 로
            // 엣지·브라우저 재검증을 없애 오리진 전송·함수 호출을 줄인다.
            'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
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
