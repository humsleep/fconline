"use client";

import { getFormation, type Slot } from "@/lib/squad/formations";

export interface FilledSlot {
  spid: number;
  name: string;
}

export default function SquadPitch({
  formationId,
  filled,
  onSlotClick,
}: {
  formationId: string;
  filled: Record<string, FilledSlot>;
  onSlotClick?: (slot: Slot) => void;
}) {
  const formation = getFormation(formationId);

  return (
    <div
      className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-line"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, var(--surface)) 0%, var(--surface) 60%)",
      }}
    >
      {/* 피치 라인 */}
      <svg
        viewBox="0 0 100 133"
        className="absolute inset-0 h-full w-full"
        fill="none"
        stroke="var(--ink)"
        strokeOpacity="0.12"
        strokeWidth="0.5"
        aria-hidden
      >
        <rect x="4" y="4" width="92" height="125" rx="2" />
        <line x1="4" y1="66" x2="96" y2="66" />
        <circle cx="50" cy="66" r="12" />
        <rect x="28" y="4" width="44" height="16" />
        <rect x="28" y="113" width="44" height="16" />
      </svg>

      {formation.slots.map((slot) => {
        const p = filled[slot.id];
        const content = (
          <span className="flex flex-col items-center gap-1">
            {p ? (
              <img
                src={`/api/player-image/${p.spid}`}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 rounded-full border-2 border-accent bg-surface-2 object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-line bg-surface-2/70 text-lg text-muted">
                +
              </span>
            )}
            <span
              className={`scoreboard max-w-[64px] truncate rounded px-1 text-[11px] font-bold ${
                p ? "bg-bg/70 text-ink" : "text-muted"
              }`}
            >
              {p ? p.name : slot.pos}
            </span>
          </span>
        );

        const style = {
          left: `${slot.x}%`,
          top: `${(slot.y / 100) * 100}%`,
        } as const;

        return onSlotClick ? (
          <button
            key={slot.id}
            type="button"
            onClick={() => onSlotClick(slot)}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
            style={style}
          >
            {content}
          </button>
        ) : (
          <div
            key={slot.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={style}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
