import 'server-only';

export interface PlayerHit {
  spid: number; // 대표(최신 시즌) 카드 식별자
  pid: number; // 실선수 고유번호 (spid 뒤 6자리)
  name: string;
}

interface PlayerIndex {
  nameById: Map<number, string>;
  // 실선수(pid)별 대표 카드 — 검색·스쿼드 빌더용
  reps: PlayerHit[];
}

// spid.json은 수 MB — Next 데이터 캐시(2MB 제한)에 안 들어가므로
// no-store로 받아 모듈(람다 인스턴스) 레벨에 메모이즈.
let index: PlayerIndex | null = null;
let loading: Promise<PlayerIndex> | null = null;

function pidOf(spid: number): number {
  return spid % 1_000_000;
}

async function loadIndex(): Promise<PlayerIndex> {
  if (index) return index;
  if (loading) return loading;

  loading = (async () => {
    const nameById = new Map<number, string>();
    const bestByPid = new Map<number, PlayerHit>();
    try {
      const res = await fetch(
        'https://open.api.nexon.com/static/fconline/meta/spid.json',
        { cache: 'no-store' }
      );
      if (res.ok) {
        const list = (await res.json()) as { id: number; name: string }[];
        for (const p of list) {
          nameById.set(p.id, p.name);
          const pid = pidOf(p.id);
          const cur = bestByPid.get(pid);
          // 같은 실선수의 여러 시즌 중 최신(최대 spid)을 대표로
          if (!cur || p.id > cur.spid) {
            bestByPid.set(pid, { spid: p.id, pid, name: p.name });
          }
        }
      }
    } catch {
      // 로드 실패 시 빈 인덱스 — 이름 대신 spId 표기로 강등
    }
    const built: PlayerIndex = {
      nameById,
      reps: [...bestByPid.values()],
    };
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

/** 이름으로 실선수 검색 (실선수 1명당 대표 카드 1개). 접두 일치 우선. */
export async function searchPlayers(
  q: string,
  limit = 20
): Promise<PlayerHit[]> {
  const query = q.trim();
  if (query.length < 1) return [];
  const idx = await loadIndex();

  const matches = idx.reps.filter((p) => p.name.includes(query));
  matches.sort((a, b) => {
    // 접두 일치 → 이름 길이 → 최신 시즌
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
