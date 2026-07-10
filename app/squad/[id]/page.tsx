import type { Metadata } from "next";
import Link from "next/link";
import ShareCardButton from "@/app/components/ShareCardButton";
import { getFormation } from "@/lib/squad/formations";
import { getSquad } from "@/lib/squad/store";
import SquadPitch, { type Coord, type FilledSlot } from "../SquadPitch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const squad = await getSquad(id).catch(() => null);
  return {
    title: squad ? `${squad.name}` : "스쿼드",
    description: squad
      ? `${squad.name} — ${getFormation(squad.formation).name} 스쿼드`
      : "스쿼드 공유",
  };
}

export default async function SquadViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const squad = await getSquad(id).catch(() => null);

  if (!squad) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center">
        <h1 className="text-xl font-bold">스쿼드를 찾을 수 없어요</h1>
        <p className="mt-2 text-sm text-muted">
          삭제되었거나 잘못된 링크일 수 있어요.
        </p>
        <Link
          href="/squad"
          className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink"
        >
          새 스쿼드 만들기
        </Link>
      </div>
    );
  }

  const filled: Record<string, FilledSlot> = {};
  const coords: Record<string, Coord> = {};
  for (const s of squad.slots) {
    filled[s.slotId] = { spid: s.spid, name: s.name };
    if (typeof s.x === "number" && typeof s.y === "number") {
      coords[s.slotId] = { x: s.x, y: s.y };
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 md:pb-16">
      <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
        {getFormation(squad.formation).name} · {squad.slots.length}명
      </p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{squad.name}</h1>

      <div className="mt-4">
        <SquadPitch formationId={squad.formation} filled={filled} coords={coords} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ShareCardButton
          url={`/api/card/squad/${squad.id}`}
          filename={`fclab-squad-${squad.id}.png`}
          label="스쿼드 카드 저장 · 공유"
        />
        <Link
          href="/squad"
          className="scoreboard rounded-lg bg-surface-2 px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-line"
        >
          내 스쿼드 만들기
        </Link>
      </div>
    </div>
  );
}
