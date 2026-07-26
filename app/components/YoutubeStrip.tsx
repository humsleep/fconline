import { loadVideos } from "@/lib/youtube/feed";
import { formatRelativeKr } from "@/lib/format";
import type { YtChannel } from "@/lib/youtube/channels";

/**
 * 홈 영상 스트립 — 큐레이션 채널의 최신 유튜브 영상 (RSS, 6시간 캐시).
 * 카드 탭 → 유튜브 새 탭(체류 이탈 최소화). 채널 없거나 전부 실패 시 미표시.
 * 썸네일은 외부(i.ytimg.com)라 next/image 대신 plain img (remotePatterns 설정 불필요).
 */
export default async function YoutubeStrip({
  title,
  channels,
}: {
  title: string;
  channels: YtChannel[];
}) {
  const videos = await loadVideos(channels, 8);
  if (videos.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="scoreboard text-xs font-semibold tracking-[0.25em] text-muted">
        {title}
      </h2>
      <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto pb-1">
        {videos.map((v) => (
          <a
            key={v.id}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="panel group w-40 flex-none overflow-hidden transition-colors hover:border-accent/50 sm:w-48"
          >
            <div className="relative aspect-video bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.thumb}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span
                aria-hidden
                className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-bold text-white"
              >
                ▶
              </span>
            </div>
            <div className="p-2.5">
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug group-hover:text-accent">
                {v.title}
              </p>
              <p className="mt-1 truncate text-[12px] text-muted">
                {v.channel} · {formatRelativeKr(v.published)}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
