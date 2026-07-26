import 'server-only';
import type { YtChannel } from './channels';

export interface YtVideo {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  published: string; // ISO
  url: string;
  thumb: string;
}

const FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function pick(entry: string, tag: string): string {
  const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeEntities(m[1].trim()) : '';
}

/** 유튜브 채널 RSS(xml) → 최신 영상 목록. 순수 함수(네트워크 X) — 단위 테스트 대상. */
export function parseFeed(
  xml: string,
  ch: YtChannel,
  perChannel = 2
): YtVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const out: YtVideo[] = [];
  for (const e of entries.slice(0, perChannel)) {
    const id = pick(e, 'yt:videoId');
    if (!id) continue;
    out.push({
      id,
      title: pick(e, 'title'),
      channel: ch.name,
      channelId: ch.channelId,
      published: pick(e, 'published'),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    });
  }
  return out;
}

/** 채널 1개의 최신 업로드 몇 건. 실패 시 빈 배열(절대 throw 안 함). */
async function fetchChannelLatest(
  ch: YtChannel,
  perChannel: number
): Promise<YtVideo[]> {
  try {
    const res = await fetch(`${FEED_BASE}${ch.channelId}`, {
      // 유튜브를 크롤마다 때리지 않도록 6시간 캐시(콘텐츠 신선도엔 충분)
      next: { revalidate: 21_600 },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), ch, perChannel);
  } catch {
    return [];
  }
}

/** 채널 목록의 최신 영상을 병합·최신순 정렬 후 상위 limit개. 전부 실패 시 빈 배열. */
export async function loadVideos(
  channels: YtChannel[],
  limit = 8,
  perChannel = 2
): Promise<YtVideo[]> {
  if (channels.length === 0) return [];
  const lists = await Promise.all(
    channels.map((c) => fetchChannelLatest(c, perChannel))
  );
  return lists
    .flat()
    .sort((a, b) => (a.published < b.published ? 1 : -1))
    .slice(0, limit);
}
