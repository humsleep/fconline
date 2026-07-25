"use client";

/**
 * 클라이언트 localStorage 기반 개인화 (로그인 불필요) — 즐겨찾기 구단주 + 방문 스트릭.
 * 모든 접근은 try/catch로 감싸 storage 불가 환경(사파리 프라이빗 등)에서도 앱이 죽지 않게 한다.
 */

const FAV_KEY = "fcscope-favorites";
const STREAK_KEY = "fcscope-streak";
const FAV_MAX = 20;

// ── 즐겨찾기 ─────────────────────────────────────────────
export function getFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((x) => typeof x === "string").slice(0, FAV_MAX)
      : [];
  } catch {
    return [];
  }
}

export function isFavorite(nickname: string): boolean {
  return getFavorites().some((n) => n.toLowerCase() === nickname.toLowerCase());
}

/** 토글 후 최신 즐겨찾기 목록 반환. */
export function toggleFavorite(nickname: string): string[] {
  const name = nickname.trim();
  if (!name) return getFavorites();
  try {
    const cur = getFavorites();
    const exists = cur.some((n) => n.toLowerCase() === name.toLowerCase());
    const next = exists
      ? cur.filter((n) => n.toLowerCase() !== name.toLowerCase())
      : [name, ...cur].slice(0, FAV_MAX);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getFavorites();
  }
}

// ── 방문 스트릭 ───────────────────────────────────────────
export interface Streak {
  current: number;
  best: number;
  last: string; // YYYY-MM-DD (로컬 기준)
}

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function readStreak(): Streak | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null");
    if (
      raw &&
      typeof raw.current === "number" &&
      typeof raw.best === "number" &&
      typeof raw.last === "string"
    )
      return raw as Streak;
  } catch {
    // ignore
  }
  return null;
}

/** 기록 없이 현재 스트릭만 읽기 (표시 전용). */
export function getStreak(): Streak | null {
  return readStreak();
}

/** 오늘 방문 기록 후 갱신된 스트릭 반환. 하루 1회만 카운트. */
export function recordVisit(): Streak {
  const today = todayStr();
  const prev = readStreak();
  let next: Streak;
  if (!prev) {
    next = { current: 1, best: 1, last: today };
  } else if (prev.last === today) {
    next = prev; // 오늘 이미 카운트됨
  } else {
    const gap = daysBetween(prev.last, today);
    const current = gap === 1 ? prev.current + 1 : 1; // 연속이면 +1, 아니면 리셋
    next = { current, best: Math.max(prev.best, current), last: today };
  }
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
