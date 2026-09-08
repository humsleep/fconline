/**
 * 사용자 차단(기기 로컬) — 커뮤니티 UGC 요건(App Store 1.2: 신고 + 차단).
 * 차단한 작성자의 글·댓글은 이 기기에서 숨긴다. 서버 저장 없음(로그인 불필요, 즉시 동작).
 */

const KEY = 'fcscope-blocked-users';
export const BLOCKLIST_EVENT = 'fcscope-blocklist';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 프라이빗 모드 등 — 무시
  }
  try {
    window.dispatchEvent(new CustomEvent(BLOCKLIST_EVENT));
  } catch {
    // ignore
  }
}

export function getBlocked(): string[] {
  return read();
}

export function isBlocked(authorId: string | null | undefined): boolean {
  return Boolean(authorId) && read().includes(authorId as string);
}

export function blockUser(authorId: string): void {
  const list = read();
  if (!list.includes(authorId)) write([...list, authorId].slice(-500));
}

export function unblockUser(authorId: string): void {
  write(read().filter((id) => id !== authorId));
}

export function clearBlocked(): void {
  write([]);
}
