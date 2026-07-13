import Link from "next/link";
import { getSquad } from "@/lib/squad/store";
import { getFormation } from "@/lib/squad/formations";
import { getSeasonNames } from "@/lib/nexon/players";
import SquadPitch, { type Coord, type FilledSlot } from "@/app/squad/SquadPitch";
import SeasonMix from "@/app/squad/SeasonMix";

/**
 * 커뮤니티 글에 첨부된 스쿼드를 본문과 함께 펼쳐서 보여준다(링크 클릭 불필요).
 * 읽기 전용 SquadPitch(콜백 없음 → 정적 렌더) + 시즌 팀컬러 요약.
 */
export default async function AttachedSquad({ squadId }: { squadId: string }) {
  const squad = await getSquad(squadId).catch(() => null);

  // 삭제되었거나 못 불러온 경우: 조용히 링크만 (본문 흐름 방해 안 함)
  if (!squad) {
    return (
      <Link
        href={`/squad/${encodeURIComponent(squadId)}`}
        className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 transition hover:border-accent"
      >
        <span className="text-sm font-semibold">🧩 첨부된 스쿼드 보기</span>
        <span className="text-sm text-accent">열기 →</span>
      </Link>
    );
  }

  const seasons = await getSeasonNames(squad.slots.map((s) => s.spid));
  const filled: Record<string, FilledSlot> = {};
  const coords: Record<string, Coord> = {};
  for (const s of squad.slots) {
    filled[s.slotId] = { spid: s.spid, name: s.name, season: s.season ?? seasons.get(s.spid) };
    if (typeof s.x === "number" && typeof s.y === "number") coords[s.slotId] = { x: s.x, y: s.y };
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.15em] text-muted">
            🧩 첨부 스쿼드
          </p>
          <p className="truncate text-sm font-bold">
            {squad.name}{" "}
            <span className="font-semibold text-muted">
              · {getFormation(squad.formation).name} · {squad.slots.length}명
            </span>
          </p>
        </div>
        <Link
          href={`/squad/${encodeURIComponent(squad.id)}`}
          className="flex-none text-[13px] text-accent underline underline-offset-2"
        >
          크게 보기 →
        </Link>
      </div>
      <SquadPitch formationId={squad.formation} filled={filled} coords={coords} />
      <SeasonMix seasons={squad.slots.map((s) => s.season ?? seasons.get(s.spid))} compact />
    </div>
  );
}
