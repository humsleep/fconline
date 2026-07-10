import 'server-only';

export interface SeasonVariant {
  spid: number;
  season: string; // 시즌(클래스) 짧은 이름, 예: "TOTY", "아이콘"
}

export interface PlayerHit {
  spid: number; // 대표(최신 시즌) 카드 식별자
  pid: number; // 실선수 고유번호 (spid 뒤 6자리)
  name: string;
  season: string; // 대표 카드 시즌
  seasons: SeasonVariant[]; // 보유 시즌 전체(최신순)
}

interface PlayerIndex {
  nameById: Map<number, string>;
  seasonById: Map<number, string>; // spid → 시즌명
  reps: PlayerHit[];
}

let index: PlayerIndex | null = null;
let loading: Promise<PlayerIndex> | null = null;

const MAX_SEASONS = 16; // 결과당 노출 시즌 상한

export function seasonIdOf(spid: number): number {
  return Math.floor(spid / 1_000_000);
}
function pidOf(spid: number): number {
  return spid % 1_000_000;
}
// "TOTY (2022~2023 시즌)" → "TOTY" 처럼 괄호 설명 제거
function shortSeason(className: string): string {
  return className.split(/[(（]/)[0].trim() || className;
}

async function loadIndex(): Promise<PlayerIndex> {
  if (index) return index;
  if (loading) return loading;

  loading = (async () => {
    const nameById = new Map<number, string>();
    const seasonById = new Map<number, string>();
    const seasonNameById = new Map<number, string>(); // seasonId → 시즌명

    // 시즌 메타 먼저
    try {
      const sres = await fetch(
        'https://open.api.nexon.com/static/fconline/meta/seasonid.json',
        { next: { revalidate: 86400 } }
      );
      if (sres.ok) {
        const seasons = (await sres.json()) as {
          seasonId: number;
          className: string;
        }[];
        for (const s of seasons) {
          seasonNameById.set(s.seasonId, shortSeason(s.className));
        }
      }
    } catch {
      // 시즌 메타 실패 → 시즌ID 숫자로 폴백
    }

    const seasonName = (spid: number) =>
      seasonNameById.get(seasonIdOf(spid)) ?? `S${seasonIdOf(spid)}`;

    // 실선수(pid)별 보유 시즌 spid 목록
    const spidsByPid = new Map<number, number[]>();
    try {
      const res = await fetch(
        'https://open.api.nexon.com/static/fconline/meta/spid.json',
        { cache: 'no-store' }
      );
      if (res.ok) {
        const list = (await res.json()) as { id: number; name: string }[];
        for (const p of list) {
          nameById.set(p.id, p.name);
          seasonById.set(p.id, seasonName(p.id));
          const pid = pidOf(p.id);
          const arr = spidsByPid.get(pid);
          if (arr) arr.push(p.id);
          else spidsByPid.set(pid, [p.id]);
        }
      }
    } catch {
      // spid 로드 실패
    }

    const reps: PlayerHit[] = [];
    for (const [pid, spids] of spidsByPid) {
      spids.sort((a, b) => b - a); // 최신 시즌 먼저
      const repSpid = spids[0];
      reps.push({
        spid: repSpid,
        pid,
        name: nameById.get(repSpid) ?? `선수 ${repSpid}`,
        season: seasonById.get(repSpid) ?? '',
        seasons: spids.slice(0, MAX_SEASONS).map((s) => ({
          spid: s,
          season: seasonById.get(s) ?? '',
        })),
      });
    }

    const built: PlayerIndex = { nameById, seasonById, reps };
    index = built;
    loading = null;
    return built;
  })();

  return loading;
}

export async function getPlayerName(spId: number): Promise<string> {
  const idx = await loadIndex();
  return idx.nameById.get(spId) ?? `선수 ${spId}`;
}

export async function getPlayerNames(
  spIds: number[]
): Promise<Map<number, string>> {
  const idx = await loadIndex();
  const out = new Map<number, string>();
  for (const id of spIds) out.set(id, idx.nameById.get(id) ?? `선수 ${id}`);
  return out;
}

/** spid → 시즌(클래스) 이름 */
export async function getSeasonNames(
  spIds: number[]
): Promise<Map<number, string>> {
  const idx = await loadIndex();
  const out = new Map<number, string>();
  for (const id of spIds) {
    out.set(id, idx.seasonById.get(id) ?? `S${seasonIdOf(id)}`);
  }
  return out;
}

/** 이름으로 실선수 검색 (실선수 1명당 대표 카드 1개 + 보유 시즌). */
export async function searchPlayers(
  q: string,
  limit = 20
): Promise<PlayerHit[]> {
  const query = q.trim();
  if (query.length < 1) return [];
  const idx = await loadIndex();

  const matches = idx.reps.filter((p) => p.name.includes(query));
  matches.sort((a, b) => {
    const ap = a.name.startsWith(query) ? 0 : 1;
    const bp = b.name.startsWith(query) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return b.spid - a.spid;
  });
  return matches.slice(0, limit);
}

/** 이름으로 가장 그럴듯한 대표 카드 1개 (프리셋 해석용). */
export async function resolvePlayer(name: string): Promise<PlayerHit | null> {
  const hits = await searchPlayers(name, 1);
  return hits[0] ?? null;
}
