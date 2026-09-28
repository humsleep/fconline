import { isBot } from '@/lib/security/bot';

// 시즌(클래스) 아이콘 프록시 — seasonid.json의 seasonImg를 서버 경유로 제공.
// 넥슨 CDN 직접 로드의 CORS/핫링크 이슈 회피. 이미지 없으면 404 → 클라이언트는 텍스트 폴백.

const META_URL = 'https://open.api.nexon.com/static/fconline/meta/seasonid.json';

interface SeasonMeta {
  seasonId: number;
  className: string;
  seasonImg?: string;
}

let cache: Map<number, string> | null = null;
let cacheAt = 0;
const CACHE_TTL = 24 * 3600 * 1000;

async function seasonImgMap(): Promise<Map<number, string>> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL) return cache;
  const map = new Map<number, string>();
  try {
    const res = await fetch(META_URL, { next: { revalidate: 86400 } });
    if (res.ok) {
      const list = (await res.json()) as SeasonMeta[];
      for (const s of list) {
        const img = s.seasonImg?.trim();
        if (!img) continue;
        // 넥슨 도메인만 허용 (메타 오염 대비 방어)
        try {
          const u = new URL(img);
          if (
            u.protocol === 'https:' &&
            (u.hostname.endsWith('.nexon.com') ||
              u.hostname.endsWith('.nexoncdn.co.kr'))
          ) {
            map.set(s.seasonId, img);
          }
        } catch {
          // 잘못된 URL 무시
        }
      }
    }
  } catch {
    // 메타 실패 → 빈 맵(호출부 404)
  }
  cache = map;
  cacheAt = now;
  return map;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  // 선수 이미지 프록시와 같은 이유로 봇 차단 (docs/CLOUDFLARE.md)
  if (isBot(req.headers.get('user-agent'))) {
    return new Response(null, {
      status: 403,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  }

  const { seasonId } = await params;
  if (!/^\d{1,4}$/.test(seasonId)) {
    return new Response('invalid seasonId', { status: 400 });
  }

  const map = await seasonImgMap();
  const url = map.get(Number(seasonId));
  if (!url) return new Response('not found', { status: 404 });

  try {
    const res = await fetch(url, { next: { revalidate: 31536000 } });
    if (res.ok) {
      return new Response(res.body, {
        headers: {
          'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        },
      });
    }
  } catch {
    // 아래 404
  }
  return new Response('not found', { status: 404 });
}
