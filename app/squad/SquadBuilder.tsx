"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  formationsByLine,
  getFormation,
  type Slot,
} from "@/lib/squad/formations";
import { presetsByLeague } from "@/lib/squad/presets";
import { assignByPosition } from "@/lib/squad/assign";
import { rememberMySquad, countMySquads, MAX_MY_SQUADS } from "@/app/components/MySquadPicker";
import SeasonBadge from "@/app/components/SeasonBadge";
import SquadPitch, { type Coord, type FilledSlot } from "./SquadPitch";
import SeasonMix from "./SeasonMix";
import RankerStatPanel from "./RankerStatPanel";

interface SeasonVariant {
  spid: number;
  season: string;
}
interface PlayerHit {
  spid: number;
  pid: number;
  name: string;
  season: string;
  seasons: SeasonVariant[];
}

const LEAGUES = presetsByLeague();
const LINE_GROUPS = formationsByLine();

export default function SquadBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formationId, setFormationId] = useState("433");
  const [filled, setFilled] = useState<Record<string, FilledSlot>>({});
  const [coords, setCoords] = useState<Record<string, Coord>>({});
  const [name, setName] = useState("내 스쿼드");
  const [teamTag, setTeamTag] = useState<string | null>(null);

  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [mineNick, setMineNick] = useState("");
  const [mineLoading, setMineLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pitchWrapRef = useRef<HTMLDivElement>(null);

  // ?load={id} — 저장된 스쿼드를 불러와 수정 (마이페이지 "수정" 진입점)
  const loadedRef = useRef(false);
  useEffect(() => {
    const id = searchParams.get("load");
    if (!id || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/squad/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as {
          name?: string;
          formation?: string;
          teamTag?: string | null;
          slots?: { slotId: string; spid: number; name: string; season?: string; x?: number; y?: number }[];
        };
        setFormationId(getFormation(data.formation ?? "433").id);
        setName(data.name ?? "내 스쿼드");
        setTeamTag(data.teamTag ?? null);
        const next: Record<string, FilledSlot> = {};
        const nextCoords: Record<string, Coord> = {};
        for (const s of data.slots ?? []) {
          next[s.slotId] = { spid: s.spid, name: s.name, season: s.season };
          if (typeof s.x === "number" && typeof s.y === "number")
            nextCoords[s.slotId] = { x: s.x, y: s.y };
        }
        setFilled(next);
        setCoords(nextCoords);
        setNotice("스쿼드를 불러왔어요 — 수정 후 저장하면 새 스쿼드로 저장돼요.");
      } catch {
        setError("스쿼드를 불러오지 못했어요.");
      }
    })();
  }, [searchParams]);

  // 모바일(검색 패널이 피치 아래에 쌓이는 폭) 여부
  const isStacked = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;

  const formation = useMemo(() => getFormation(formationId), [formationId]);

  // 검색 디바운스 (패널이 항상 열려 있으므로 query만 의존)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false); // 입력 삭제 시 스피너 고착 방지
      setExpanded(null);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController(); // 늦게 도착한 이전 응답의 결과 덮어쓰기 방지
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal }
        );
        const data = await res.json();
        setResults(data.players ?? []);
        setExpanded(null);
        setSearching(false);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setResults([]);
          setSearching(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const validSlotIds = useMemo(
    () => new Set(formation.slots.map((s) => s.id)),
    [formation]
  );
  const filledCount = Object.keys(filled).filter((id) =>
    validSlotIds.has(id)
  ).length;

  // 포메이션 전환 — 기존 선수를 포지션 기반으로 새 포메이션에 재배치(유실 방지)
  function changeFormation(nextId: string) {
    const next = getFormation(nextId);
    setFilled((f) => {
      const players = Object.entries(f)
        .filter(([id]) => validSlotIds.has(id))
        .map(([id, v]) => {
          const slot = formation.slots.find((s) => s.id === id);
          return {
            pos: slot?.pos ?? "CM",
            name: v.name,
            spid: v.spid,
            season: v.season,
          };
        });
      const placed = assignByPosition(next.slots, players);
      const n: Record<string, FilledSlot> = {};
      for (const [slotId, v] of Object.entries(placed))
        n[slotId] = { spid: v.spid!, name: v.name, season: v.season };
      return n;
    });
    setCoords({});
    setFormationId(nextId);
    setActiveSlotId(null);
    setPickerOpen(false);
  }

  function firstEmptySlot(): string | null {
    for (const s of formation.slots) if (!filled[s.id]) return s.id;
    return null;
  }

  // 실선수 번호(pid) — 시즌(spid 앞 3자리)이 달라도 같은 선수면 중복 배치 금지 (인게임 규칙)
  const pidOf = (spid: number) => spid % 1_000_000;

  // 검색 결과 클릭/드롭으로 배치. 같은 선수(pid)가 이미 있으면 그 자리를 비워 중복 방지.
  function place(slotId: string | null, spid: number, name: string, season?: string) {
    const target = slotId ?? activeSlotId ?? firstEmptySlot();
    if (!target) {
      setNotice("빈 자리가 없어요. 슬롯을 비우고 다시 배치하세요.");
      return;
    }
    const n = { ...filled };
    let moved = false;
    for (const [id, v] of Object.entries(n))
      if (pidOf(v.spid) === pidOf(spid) && id !== target) {
        delete n[id];
        moved = true;
      }
    n[target] = { spid, name, season };
    setFilled(n);
    setNotice(moved ? "같은 선수는 한 명만 — 기존 자리에서 옮겼어요." : "");

    // 배치 완료 → 선택 해제 + 시즌 패널 접기. 다음 포지션은 사용자가 직접 탭해서 고른다.
    setActiveSlotId(null);
    setExpanded(null);
    if (!slotId && isStacked()) {
      // 클릭 배치(모바일): 피치로 복귀해 바로 다음 자리를 탭할 수 있게
      pitchWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function clearSlot(slotId: string) {
    setFilled((f) => {
      const n = { ...f };
      delete n[slotId];
      return n;
    });
  }

  // 드래그로 다른 자리에 떨어뜨리면 서로 교환(양쪽 다 선수면 스왑, 빈 자리면 이동).
  // 두 슬롯의 커스텀 좌표는 제거해 포메이션 기본 위치로 정렬.
  function swapSlots(fromId: string, toId: string) {
    if (fromId === toId) return;
    setFilled((f) => {
      const a = f[fromId];
      if (!a) return f; // 빈 자리를 드래그한 경우 변화 없음
      const b = f[toId];
      const n = { ...f };
      if (b) {
        n[fromId] = b;
        n[toId] = a;
      } else {
        delete n[fromId];
        n[toId] = a;
      }
      return n;
    });
    setCoords((c) => {
      const n = { ...c };
      delete n[fromId];
      delete n[toId];
      return n;
    });
    setActiveSlotId(null);
    setExpanded(null);
  }

  function focusSearch() {
    if (isStacked()) {
      searchPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    searchInputRef.current?.focus({ preventScroll: true });
    searchInputRef.current?.select();
  }

  function onSlotClick(slot: Slot) {
    // 자리를 누르면 활성 토글 + 즉시 검색(빈 자리든 채워진 자리든 교체 검색 가능)
    const next = activeSlotId === slot.id ? null : slot.id;
    setActiveSlotId(next);
    if (!next) return;
    focusSearch();
  }

  async function loadPreset(id: string) {
    if (!id) return;
    setPresetLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/squad/preset?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFormationId(data.formation);
      setName(data.name);
      setTeamTag(data.teamTag);
      const next: Record<string, FilledSlot> = {};
      for (const s of data.slots as {
        slotId: string;
        spid: number;
        name: string;
        season?: string;
      }[]) {
        next[s.slotId] = { spid: s.spid, name: s.name, season: s.season };
      }
      setFilled(next);
      setCoords({});
      setActiveSlotId(null);
      if ((data.slots?.length ?? 0) === 0)
        setError("이 팀 선수를 아직 자동 매칭하지 못했어요. 직접 채워보세요.");
    } catch {
      setError("프리셋을 불러오지 못했어요.");
    } finally {
      setPresetLoading(false);
    }
  }

  async function loadMySquad() {
    const nick = mineNick.trim();
    if (!nick || mineLoading) return;
    setMineLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/squad/from-user?nickname=${encodeURIComponent(nick)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "불러오기 실패");
      const players = (data.players ?? []) as {
        spid: number;
        name: string;
        pos: string;
        season: string;
      }[];
      // 서버가 최근 경기 라인업으로 판별한 포메이션까지 함께 적용
      const target =
        typeof data.formation === "string"
          ? getFormation(data.formation)
          : formation;
      const placed = assignByPosition(
        target.slots,
        players.map((p) => ({
          pos: p.pos,
          name: p.name,
          spid: p.spid,
          season: p.season,
        }))
      );
      const next: Record<string, FilledSlot> = {};
      for (const [slotId, v] of Object.entries(placed))
        next[slotId] = { spid: v.spid!, name: v.name, season: v.season };
      setFormationId(target.id);
      setPickerOpen(false);
      setFilled(next);
      setCoords({});
      setTeamTag(null);
      setName(`${nick} 스쿼드`);
      setActiveSlotId(null);
      setNotice(
        `가장 최근 경기의 선발 ${players.length}명을 ${target.name} 포메이션으로 불러왔어요.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setMineLoading(false);
    }
  }

  async function save() {
    // 모든 포지션(11명)을 채워야 저장 가능
    if (filledCount < formation.slots.length || saving) return;
    // 개인당 최대 10개 — 내 스쿼드 목록(이 기기)이 꽉 차면 저장 차단
    if (countMySquads() >= MAX_MY_SQUADS) {
      setError(
        `스쿼드는 최대 ${MAX_MY_SQUADS}개까지 저장할 수 있어요. 기존 스쿼드를 지운 뒤 다시 시도해 주세요.`
      );
      return;
    }
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
        rememberMySquad({ id: data.id, name, formation: formation.name });
        router.push(`/squad/${data.id}`);
      } else {
        setError(
          data.error === "save failed"
            ? "저장 기능이 아직 설정되지 않았어요."
            : (data.error ?? "저장에 실패했어요.")
        );
        setSaving(false);
      }
    } catch {
      setError("저장 중 오류가 발생했어요.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold sm:text-3xl">스쿼드 빌더</h1>
      <p className="mt-1 text-sm text-muted">
        빈 자리를 탭하면 바로 검색, 배치한 선수를 탭하면 랭커 실전 스탯. 선수를 끌면 위치까지 자유롭게.
      </p>

      {/* 빠른 시작: 프리셋 + 내 스쿼드 불러오기 */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => loadPreset(e.target.value)}
            disabled={presetLoading}
            className="input-search h-11 min-w-0 flex-1 px-3 text-sm"
            aria-label="리그·팀 프리셋"
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
        </div>
        <div className="flex items-center gap-2">
          <input
            value={mineNick}
            onChange={(e) => setMineNick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadMySquad()}
            placeholder="구단주명 → 내 스쿼드 불러오기"
            className="input-search h-11 min-w-0 flex-1 px-3 text-sm"
            aria-label="구단주명"
          />
          <button
            onClick={loadMySquad}
            disabled={mineLoading || !mineNick.trim()}
            className="scoreboard h-11 flex-none rounded-lg bg-surface-2 px-3 text-sm font-bold text-ink transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-40"
          >
            {mineLoading ? "불러오는 중…" : "불러오기"}
          </button>
        </div>
      </div>

      {/* 포메이션 picker — 접힘형(현재 포메이션 + 변경 시에만 전체 목록) */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
            className={`scoreboard flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              pickerOpen
                ? "bg-accent text-accent-ink"
                : "bg-surface-2 text-ink hover:bg-accent hover:text-accent-ink"
            }`}
          >
            {/* 라벨은 부모 색 상속 — hover/open 시 대비 유지 */}
            <span className="text-[12px] font-semibold tracking-[0.15em] text-current opacity-70">
              포메이션
            </span>
            {formation.name}
            <span aria-hidden className="text-[12px]">
              {pickerOpen ? "▲" : "▼"}
            </span>
          </button>
          <span className="scoreboard ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted">
            선수 드래그 = 자유 배치
          </span>
        </div>
        {pickerOpen && (
          <div className="panel mt-2 space-y-2.5 p-3">
            {LINE_GROUPS.map((g) => (
              <div key={g.line} className="flex flex-wrap items-center gap-1.5">
                <span className="scoreboard w-8 flex-none text-[12px] font-bold text-muted">
                  {g.label}
                </span>
                {g.items.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => changeFormation(f.id)}
                    className={`scoreboard rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                      f.id === formationId
                        ? "bg-accent text-accent-ink"
                        : "bg-surface-2 text-muted hover:text-ink"
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            ))}
            <p className="text-[13px] text-muted">
              포메이션을 바꿔도 배치한 선수는 포지션 기준으로 자동 이동합니다.
            </p>
          </div>
        )}
      </div>

      {/* 본문: 피치 + 검색 패널 */}
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
        {/* 피치 + 저장 */}
        <div ref={pitchWrapRef} className="scroll-mt-16">
          <SquadPitch
            formationId={formationId}
            filled={filled}
            coords={coords}
            activeSlotId={activeSlotId}
            onSlotClick={onSlotClick}
            onMove={(slotId, x, y) =>
              setCoords((c) => ({ ...c, [slotId]: { x, y } }))
            }
            onSwap={swapSlots}
            onDropPlayer={(slotId, p) => place(slotId, p.spid, p.name, p.season)}
          />

          {/* 시즌 팀컬러 구성 — 같은 시즌 카드가 몇 장인지 실시간 표시 */}
          {filledCount > 0 && (
            <SeasonMix
              seasons={Object.entries(filled)
                .filter(([id]) => validSlotIds.has(id))
                .map(([, v]) => v.season)}
            />
          )}

          {activeSlotId && filled[activeSlotId] && (
            <>
              <div className="mx-auto mt-2 flex max-w-md items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="text-muted">
                  선택된 자리:{" "}
                  <b className="text-ink">
                    {formation.slots.find((s) => s.id === activeSlotId)?.pos}
                  </b>
                </span>
                <button
                  onClick={() => {
                    clearSlot(activeSlotId);
                    setActiveSlotId(null);
                  }}
                  className="font-semibold text-lose"
                >
                  비우기
                </button>
              </div>
              <RankerStatPanel
                spid={filled[activeSlotId].spid}
                pos={
                  formation.slots.find((s) => s.id === activeSlotId)?.pos ?? "CM"
                }
                name={filled[activeSlotId].name}
              />
            </>
          )}

          <div className="mx-auto mt-3 flex max-w-md items-center gap-2">
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
              disabled={filledCount < formation.slots.length || saving}
              className="scoreboard h-11 flex-none rounded-lg bg-accent px-5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
          {filledCount < formation.slots.length && !error && (
            <p className="mt-2 text-center text-[13px] text-muted">
              모든 포지션(11명)을 채우면 저장할 수 있어요.
            </p>
          )}
          {error && <p className="mt-2 text-center text-sm text-lose">{error}</p>}
          {notice && <p className="mt-2 text-center text-sm text-accent">{notice}</p>}
        </div>

        {/* 검색 패널 */}
        <div ref={searchPanelRef} className="scroll-mt-16 md:sticky md:top-20 md:self-start">
          <div className="panel flex max-h-[70vh] flex-col p-3">
            <p className="text-sm font-semibold">
              선수 검색
              <span className="ml-1.5 font-normal text-muted">
                {activeSlotId
                  ? `→ ${formation.slots.find((s) => s.id === activeSlotId)?.pos} 자리`
                  : "PC는 드래그, 모바일은 자리 탭 후 선택"}
              </span>
            </p>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="선수 이름 (예: 손흥민)"
              className="input-search mt-2 h-11 px-3 text-sm"
              aria-label="선수 이름 검색"
            />
            <div className="mt-2 flex-1 overflow-y-auto">
              {searching ? (
                <p className="py-6 text-center text-sm text-muted">검색 중…</p>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  {query.trim() ? "검색 결과가 없어요." : "선수 이름을 입력하세요."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {results.map((r) => (
                    <li key={r.pid}>
                      <div
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({
                              spid: r.spid,
                              name: r.name,
                              season: r.season,
                            })
                          )
                        }
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 cursor-grab active:cursor-grabbing hover:bg-surface-2`}
                      >
                        <img
                          src={`/api/player-image/${r.spid}`}
                          alt=""
                          width={36}
                          height={36}
                          loading="lazy"
                          draggable={false}
                          className="h-9 w-9 flex-none rounded-lg bg-surface-2 object-cover"
                        />
                        <button
                          onClick={() => place(null, r.spid, r.name, r.season)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="truncate text-sm font-medium">{r.name}</span>
                          <SeasonBadge
                            spid={r.spid}
                            season={r.season}
                            className="flex-none"
                          />
                        </button>
                        {r.seasons.length > 1 && (
                          <button
                            onClick={() =>
                              setExpanded((e) => (e === r.pid ? null : r.pid))
                            }
                            className="flex min-h-11 flex-none items-center rounded px-2.5 text-[13px] font-semibold text-muted transition-colors hover:text-accent"
                            aria-label="시즌 선택"
                          >
                            시즌 {r.seasons.length}
                            {expanded === r.pid ? " ▲" : " ▼"}
                          </button>
                        )}
                      </div>
                      {expanded === r.pid && (
                        <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
                          {r.seasons.map((s) => (
                            <button
                              key={s.spid}
                              draggable
                              onDragStart={(e) =>
                                e.dataTransfer.setData(
                                  "text/plain",
                                  JSON.stringify({
                                    spid: s.spid,
                                    name: r.name,
                                    season: s.season,
                                  })
                                )
                              }
                              onClick={() => place(null, s.spid, r.name, s.season)}
                              className={`scoreboard flex min-h-11 items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] font-bold text-ink transition-colors hover:bg-accent hover:text-accent-ink cursor-grab active:cursor-grabbing`}
                            >
                              <SeasonBadge spid={s.spid} season={s.season} size="xs" />
                              {s.season || `S${Math.floor(s.spid / 1000000)}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
