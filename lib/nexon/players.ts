import 'server-only';

// spid.json은 수 MB — Next 데이터 캐시(항목 2MB 제한)에 안 들어가므로
// no-store로 받아 모듈(람다 인스턴스) 레벨에 메모이즈한다.
let playerMap: Map<number, string> | null = null;
let loading: Promise<Map<number, string>> | null = null;

async function loadPlayers(): Promise<Map<number, string>> {
  if (playerMap) return playerMap;
  if (loading) return loading;

  loading = (async () => {
    const map = new Map<number, string>();
    try {
      const res = await fetch(
        'https://open.api.nexon.com/static/fconline/meta/spid.json',
        { cache: 'no-store' }
      );
      if (res.ok) {
        const list = (await res.json()) as { id: number; name: string }[];
        for (const p of list) map.set(p.id, p.name);
      }
    } catch {
      // 로드 실패 시 빈 맵 — 이름 대신 spId 표기로 강등
    }
    playerMap = map;
    loading = null;
    return map;
  })();

  return loading;
}

export async function getPlayerName(spId: number): Promise<string> {
  const map = await loadPlayers();
  return map.get(spId) ?? `선수 ${spId}`;
}

export async function getPlayerNames(
  spIds: number[]
): Promise<Map<number, string>> {
  const map = await loadPlayers();
  const out = new Map<number, string>();
  for (const id of spIds) out.set(id, map.get(id) ?? `선수 ${id}`);
  return out;
}
