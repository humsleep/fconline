"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FORMATIONS, getFormation, type Slot } from "@/lib/squad/formations";
import { presetsByLeague } from "@/lib/squad/presets";
import SquadPitch, { type Coord, type FilledSlot } from "./SquadPitch";

interface PlayerHit {
  spid: number;
  pid: number;
  name: string;
}

const LEAGUES = presetsByLeague();

export default function SquadBuilder() {
  const router = useRouter();
  const [formationId, setFormationId] = useState("433");
  const [filled, setFilled] = useState<Record<string, FilledSlot>>({});
  const [coords, setCoords] = useState<Record<string, Coord>>({});
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("내 스쿼드");
  const [teamTag, setTeamTag] = useState<string | null>(null);

  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [error, setError] = useState("");

  // 검색 디바운스
  useEffect(() => {
    if (!activeSlot) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.players ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, activeSlot]);

  // 모달 Escape 닫기
  useEffect(() => {
    if (!activeSlot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveSlot(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeSlot]);

  // 현재 포메이션에 실제로 존재하는 슬롯만 카운트 (orphan 제외)
  const validSlotIds = new Set(getFormation(formationId).slots.map((s) => s.id));
  const filledCount = Object.keys(filled).filter((id) =>
    validSlotIds.has(id)
  ).length;

  // 포메이션 교체 — 새 포메이션에 없는 슬롯의 선수/좌표 정리(무음 손실 방지)
  function changeFormation(nextId: string) {
    const nextValid = new Set(getFormation(nextId).slots.map((s) => s.id));
    setFilled((f) => {
      const n: Record<string, FilledSlot> = {};
      for (const [id, v] of Object.entries(f)) if (nextValid.has(id)) n[id] = v;
      return n;
    });
    setCoords({}); // 포메이션 바꾸면 커스텀 좌표 초기화(기본 배치로)
    setFormationId(nextId);
  }

  function assign(hit: PlayerHit) {
    if (!activeSlot) return;
    setFilled((f) => ({ ...f, [activeSlot.id]: { spid: hit.spid, name: hit.name } }));
    setActiveSlot(null);
    setQuery("");
    setResults([]);
  }

  function clearSlot(slotId: string) {
    setFilled((f) => {
      const n = { ...f };
      delete n[slotId];
      return n;
    });
  }

  async function loadPreset(id: string) {
    if (!id) return;
    setPresetLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/squad/preset?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFormationId(data.formation);
      setName(data.name);
      setTeamTag(data.teamTag);
      const next: Record<string, FilledSlot> = {};
      for (const s of data.slots as { slotId: string; spid: number; name: string }[]) {
        next[s.slotId] = { spid: s.spid, name: s.name };
      }
      setFilled(next);
      setCoords({});
      if ((data.slots?.length ?? 0) === 0) {
        setError("이 팀 선수를 아직 자동 매칭하지 못했어요. 직접 채워보세요.");
      }
    } catch {
      setError("프리셋을 불러오지 못했어요.");
    } finally {
      setPresetLoading(false);
    }
  }

  async function save() {
    if (filledCount === 0 || saving) return;
    setSaving(true);
    setError("");
    try {
      const slots = Object.entries(filled)
        .filter(([slotId]) => validSlotIds.has(slotId))
        .map(([slotId, v]) => ({
          slotId,
          spid: v.spid,
          name: v.name,
          ...(coords[slotId] ? { x: coords[slotId].x, y: coords[slotId].y } : {}),
        }));
      const res = await fetch("/api/squad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, formation: formationId, slots, teamTag }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/squad/${data.id}`);
      } else {
        setError(data.error === "save failed" ? "저장 기능이 아직 설정되지 않았어요." : "저장에 실패했어요.");
        setSaving(false);
      }
    } catch {
      setError("저장 중 오류가 발생했어요.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold sm:text-3xl">스쿼드 빌더</h1>
      <p className="mt-1 text-[13px] text-muted">
        포메이션을 고르고 선수를 배치하세요. 리그·팀을 고르면 자동으로 채워드립니다.
      </p>

      {/* 팀 프리셋 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-[13px] font-semibold text-muted">빠른 시작</label>
        <select
          defaultValue=""
          onChange={(e) => loadPreset(e.target.value)}
          disabled={presetLoading}
          className="input-search h-10 max-w-full px-3 text-sm"
        >
          <option value="">리그 · 팀 선택</option>
          {LEAGUES.map((lg) => (
            <optgroup key={lg.league} label={lg.league}>
              {lg.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.team}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {presetLoading && <span className="text-[13px] text-muted">불러오는 중…</span>}
      </div>

      {/* 포메이션 + 커스텀 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {FORMATIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => changeFormation(f.id)}
            className={`scoreboard rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              f.id === formationId
                ? "bg-accent text-accent-ink"
                : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {f.name}
          </button>
        ))}
        <button
          onClick={() => setCustom((c) => !c)}
          className={`scoreboard ml-auto rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            custom ? "bg-gold/20 text-gold" : "bg-surface-2 text-muted hover:text-ink"
          }`}
        >
          {custom ? "✓ 자유 배치" : "자유 배치"}
        </button>
      </div>
      {custom && (
        <p className="mt-2 text-[13px] text-muted">
          선수를 <b className="text-ink">드래그</b>해 원하는 위치로 옮기세요. 탭하면
          선수 교체.
        </p>
      )}

      {/* 피치 */}
      <div className="mt-4">
        <SquadPitch
          formationId={formationId}
          filled={filled}
          coords={coords}
          onSlotClick={(slot) => {
            setActiveSlot(slot);
            setQuery("");
            setResults([]);
          }}
          onMove={
            custom
              ? (slotId, x, y) => setCoords((c) => ({ ...c, [slotId]: { x, y } }))
              : undefined
          }
        />
      </div>

      {/* 이름 + 저장 */}
      <div className="mt-4 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="input-search h-11 flex-1 px-3 text-sm"
          placeholder="스쿼드 이름"
          aria-label="스쿼드 이름"
        />
        <button
          onClick={save}
          disabled={filledCount === 0 || saving}
          className="scoreboard h-11 flex-none rounded-lg bg-accent px-5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "저장 중…" : `저장 · 공유 (${filledCount}/11)`}
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-lose">{error}</p>}

      {/* 선수 검색 모달 */}
      {activeSlot && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setActiveSlot(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="squad-modal-title"
            className="panel flex max-h-[80vh] w-full max-w-md flex-col rounded-b-none p-4 sm:rounded-b-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="squad-modal-title" className="text-base font-bold">
                {activeSlot.pos} 선수 선택
              </h2>
              <div className="flex items-center gap-2">
                {filled[activeSlot.id] && (
                  <button
                    onClick={() => {
                      clearSlot(activeSlot.id);
                      setActiveSlot(null);
                    }}
                    className="text-[13px] text-lose"
                  >
                    비우기
                  </button>
                )}
                <button
                  onClick={() => setActiveSlot(null)}
                  className="text-[13px] text-muted"
                  aria-label="닫기"
                >
                  닫기
                </button>
              </div>
            </div>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="선수 이름 검색 (예: 손흥민)"
              className="input-search mt-3 h-11 px-3 text-sm"
            />
            <div className="mt-3 flex-1 overflow-y-auto">
              {searching ? (
                <p className="py-6 text-center text-sm text-muted">검색 중…</p>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  {query.trim() ? "검색 결과가 없어요." : "선수 이름을 입력하세요."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {results.map((r) => (
                    <li key={r.spid}>
                      <button
                        onClick={() => assign(r)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <img
                          src={`/api/player-image/${r.spid}`}
                          alt=""
                          width={36}
                          height={36}
                          loading="lazy"
                          className="h-9 w-9 flex-none rounded-lg bg-surface-2 object-cover"
                        />
                        <span className="text-sm font-medium">{r.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
