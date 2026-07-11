"use client";

import { useRef } from "react";
import { getFormation, type Slot } from "@/lib/squad/formations";
import SeasonBadge from "@/app/components/SeasonBadge";

export interface FilledSlot {
  spid: number;
  name: string;
  season?: string; // 시즌(클래스) 이름
}

export interface Coord {
  x: number;
  y: number;
}

export interface DropPayload {
  spid: number;
  name: string;
  season?: string;
}

export default function SquadPitch({
  formationId,
  filled,
  coords,
  activeSlotId,
  onSlotClick,
  onMove,
  onDropPlayer,
}: {
  formationId: string;
  filled: Record<string, FilledSlot>;
  coords?: Record<string, Coord>;
  activeSlotId?: string | null;
  onSlotClick?: (slot: Slot) => void;
  /** 커스텀 모드: 드래그로 좌표 변경 */
  onMove?: (slotId: string, x: number, y: number) => void;
  /** 검색 패널에서 선수를 드롭했을 때 */
  onDropPlayer?: (slotId: string, payload: DropPayload) => void;
}) {
  const formation = getFormation(formationId);
  const pitchRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  function posOf(slot: Slot): Coord {
    return coords?.[slot.id] ?? { x: slot.x, y: slot.y };
  }

  function clientToPct(clientX: number, clientY: number): Coord {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(97, Math.max(3, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function onPointerDown(e: React.PointerEvent, slot: Slot) {
    if (!onMove) return;
    dragRef.current = { id: slot.id, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !onMove) return;
    d.moved = true;
    const { x, y } = clientToPct(e.clientX, e.clientY);
    onMove(d.id, Math.round(x), Math.round(y));
  }
  function onPointerUp(slot: Slot) {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) onSlotClick?.(slot);
  }

  function handleDrop(e: React.DragEvent, slotId: string) {
    if (!onDropPlayer) return;
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;
      const payload = JSON.parse(raw) as DropPayload;
      if (typeof payload?.spid === "number") onDropPlayer(slotId, payload);
    } catch {
      // 잘못된 페이로드 무시
    }
  }

  return (
    <div
      ref={pitchRef}
      className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-line"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, var(--surface)) 0%, var(--surface) 60%)",
        touchAction: onMove ? "none" : undefined,
      }}
    >
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
        const { x, y } = posOf(slot);
        const active = activeSlotId === slot.id;
        const content = (
          <span className="flex flex-col items-center gap-1">
            {p ? (
              <img
                src={`/api/player-image/${p.spid}`}
                alt=""
                width={44}
                height={44}
                draggable={false}
                className={`h-11 w-11 rounded-full border-2 bg-surface-2 object-cover ${
                  active ? "border-gold ring-2 ring-gold/40" : "border-accent"
                }`}
              />
            ) : (
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed bg-surface-2/70 text-lg ${
                  active
                    ? "border-gold text-gold ring-2 ring-gold/40"
                    : "border-line text-muted"
                }`}
              >
                +
              </span>
            )}
            <span
              className={`scoreboard max-w-[68px] truncate rounded px-1 text-[11px] font-bold ${
                p ? "bg-bg/70 text-ink" : active ? "text-gold" : "text-muted"
              }`}
            >
              {p ? p.name : slot.pos}
            </span>
            {p && (
              <SeasonBadge
                spid={p.spid}
                season={p.season}
                size="xs"
                className="-mt-0.5 max-w-[68px] rounded bg-bg/60 px-0.5"
              />
            )}
          </span>
        );

        const style = { left: `${x}%`, top: `${y}%` } as const;

        // 커스텀 모드: 포인터 드래그로 위치 이동
        if (onMove) {
          return (
            <button
              key={slot.id}
              type="button"
              onPointerDown={(e) => onPointerDown(e, slot)}
              onPointerMove={onPointerMove}
              onPointerUp={() => onPointerUp(slot)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
              style={style}
            >
              {content}
            </button>
          );
        }

        // 일반 모드: 클릭(활성화) + 선수 드롭 타깃
        return onSlotClick || onDropPlayer ? (
          <button
            key={slot.id}
            type="button"
            onClick={() => onSlotClick?.(slot)}
            onDragOver={onDropPlayer ? (e) => e.preventDefault() : undefined}
            onDrop={onDropPlayer ? (e) => handleDrop(e, slot.id) : undefined}
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
