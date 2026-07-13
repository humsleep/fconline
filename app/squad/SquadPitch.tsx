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

// 탭과 드래그를 구분하는 이동 임계값(px) — 모바일 손떨림으로 탭이 드래그로 오인되지 않게
const DRAG_THRESHOLD = 6;

export default function SquadPitch({
  formationId,
  filled,
  coords,
  activeSlotId,
  onSlotClick,
  onMove,
  onSwap,
  onDropPlayer,
}: {
  formationId: string;
  filled: Record<string, FilledSlot>;
  coords?: Record<string, Coord>;
  activeSlotId?: string | null;
  onSlotClick?: (slot: Slot) => void;
  /** 슬롯 드래그로 좌표 변경 (자유 배치 — 상시 허용) */
  onMove?: (slotId: string, x: number, y: number) => void;
  /** 드래그를 다른 자리 위에서 놓으면 두 슬롯 교환/이동 */
  onSwap?: (fromSlotId: string, toSlotId: string) => void;
  /** 검색 패널에서 선수를 드롭했을 때 */
  onDropPlayer?: (slotId: string, payload: DropPayload) => void;
}) {
  const formation = getFormation(formationId);
  const pitchRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    moved: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const interactive = Boolean(onSlotClick || onMove || onDropPlayer);

  // 드롭 지점에서 가장 가까운 '다른' 슬롯 찾기 (스왑 대상). 임계 밖이면 null → 자유 배치 유지.
  const SNAP_THRESHOLD = 13; // % 거리
  function nearestOtherSlot(fromId: string, pt: Coord): Slot | null {
    let best: Slot | null = null;
    let bestDist = Infinity;
    for (const s of formation.slots) {
      if (s.id === fromId) continue;
      const p = posOf(s);
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best && bestDist <= SNAP_THRESHOLD ? best : null;
  }

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
    dragRef.current = {
      id: slot.id,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !onMove) return;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    if (!d.moved) {
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (dist < DRAG_THRESHOLD) return; // 아직 탭 범위
      d.moved = true;
    }
    const { x, y } = clientToPct(e.clientX, e.clientY);
    onMove(d.id, Math.round(x), Math.round(y));
  }
  function onPointerUp(slot: Slot) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    // 임계값 미만 이동 = 탭(선수 선택/검색)
    if (!d.moved) {
      onSlotClick?.(slot);
      return;
    }
    // 드래그 종료: 다른 자리 위에 놓았고 그 자리를 드래그한 선수가 채우고 있으면 교환/이동
    if (onSwap && filled[d.id]) {
      const target = nearestOtherSlot(d.id, clientToPct(d.lastX, d.lastY));
      if (target) onSwap(d.id, target.id);
    }
    // 대상이 없으면 onMove로 이미 반영된 자유 배치 좌표를 유지
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
              className={`scoreboard max-w-[68px] truncate rounded px-1 text-[12px] font-bold ${
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

        // 인터랙티브: 탭=선택 · 드래그=자유 배치 · 드롭=선수 배치 (전부 상시)
        return interactive ? (
          <button
            key={slot.id}
            type="button"
            onPointerDown={(e) => onPointerDown(e, slot)}
            onPointerMove={onPointerMove}
            onPointerUp={() => onPointerUp(slot)}
            onDragOver={onDropPlayer ? (e) => e.preventDefault() : undefined}
            onDrop={onDropPlayer ? (e) => handleDrop(e, slot.id) : undefined}
            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 ${
              onMove ? "cursor-grab touch-none active:cursor-grabbing" : ""
            }`}
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
