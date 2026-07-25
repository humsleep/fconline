import Link from "next/link";
import Image from "next/image";
import { loadPicks, pickTopMover, LINE_TITLE } from "@/lib/meta/picks";
import { getPlayerNames } from "@/lib/nexon/players";
import { getPositionLabel } from "@/lib/nexon/meta";

/**
 * 홈 "오늘의 급상승" — 매일 바뀌는 랭커 픽 delta를 홈 첫 화면에 노출(데일리 방문 훅).
 * 스냅샷 없으면(콜드/미설정) 아무것도 렌더하지 않음.
 */
export default async function TodayMover() {
  const { byLine } = await loadPicks();
  const mover = pickTopMover(byLine);
  if (!mover) return null;
  const names = await getPlayerNames([mover.spId]);
  const name = names.get(mover.spId) ?? `선수 ${mover.spId}`;

  return (
    <Link
      href={`/player/${mover.spId}`}
      className="panel flex items-center gap-3 border-win/40 px-4 py-3 transition-colors hover:border-accent"
    >
      <Image
        src={`/api/player-image/${mover.spId}`}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 flex-none rounded-lg bg-surface-2 object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="scoreboard text-[12px] font-bold tracking-[0.2em] text-win">
          ⚡ 오늘의 급상승
        </p>
        <p className="mt-0.5 truncate text-sm font-bold">
          {name}
          <span className="ml-1.5 text-[13px] font-medium text-muted">
            {getPositionLabel(mover.position)} · {LINE_TITLE[mover.line] ?? mover.line}
          </span>
        </p>
      </div>
      <span
        className={`scoreboard flex-none rounded-lg px-2.5 py-1.5 text-sm font-bold ${
          mover.delta === null ? "bg-gold/15 text-gold" : "bg-win/15 text-win"
        }`}
      >
        {mover.delta === null ? "NEW" : `▲${mover.delta}`}
      </span>
    </Link>
  );
}
