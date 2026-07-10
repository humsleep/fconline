// 리그 → 팀 프리셋 (큐레이션, 외부 API 키 불필요).
// 선수명은 spid.json에서 best-effort 매칭 → 못 찾으면 슬롯 비움(사용자가 채움).
// 커버리지 확장은 추후 API-Football(/players/squads) 연동으로.

export interface PresetPlayer {
  slot: string; // 포메이션 슬롯 id
  name: string; // FC온라인 한글 표기(추정)
}

export interface TeamPreset {
  id: string;
  league: string;
  team: string;
  formation: string;
  players: PresetPlayer[];
}

export const PRESETS: TeamPreset[] = [
  {
    id: "arsenal",
    league: "프리미어리그",
    team: "아스날",
    formation: "433",
    players: [
      { slot: "gk", name: "라야" },
      { slot: "rb", name: "화이트" },
      { slot: "rcb", name: "살리바" },
      { slot: "lcb", name: "가브리엘" },
      { slot: "lb", name: "진첸코" },
      { slot: "rcm", name: "라이스" },
      { slot: "cm", name: "외데고르" },
      { slot: "lcm", name: "하베르츠" },
      { slot: "rw", name: "사카" },
      { slot: "st", name: "제주스" },
      { slot: "lw", name: "마르티넬리" },
    ],
  },
  {
    id: "mancity",
    league: "프리미어리그",
    team: "맨체스터 시티",
    formation: "433",
    players: [
      { slot: "gk", name: "에데르송" },
      { slot: "rb", name: "워커" },
      { slot: "rcb", name: "디아스" },
      { slot: "lcb", name: "그바르디올" },
      { slot: "lb", name: "아케" },
      { slot: "rcm", name: "로드리" },
      { slot: "cm", name: "데 브라위너" },
      { slot: "lcm", name: "베르나르두 실바" },
      { slot: "rw", name: "포든" },
      { slot: "st", name: "홀란드" },
      { slot: "lw", name: "도쿠" },
    ],
  },
  {
    id: "liverpool",
    league: "프리미어리그",
    team: "리버풀",
    formation: "433",
    players: [
      { slot: "gk", name: "알리송" },
      { slot: "rb", name: "알렉산더-아놀드" },
      { slot: "rcb", name: "코나테" },
      { slot: "lcb", name: "반 다이크" },
      { slot: "lb", name: "로버트슨" },
      { slot: "rcm", name: "맥 알리스터" },
      { slot: "cm", name: "그라벤베르흐" },
      { slot: "lcm", name: "소보슬라이" },
      { slot: "rw", name: "살라" },
      { slot: "st", name: "누녜스" },
      { slot: "lw", name: "디아스" },
    ],
  },
  {
    id: "tottenham",
    league: "프리미어리그",
    team: "토트넘",
    formation: "433",
    players: [
      { slot: "gk", name: "비카리오" },
      { slot: "rb", name: "포로" },
      { slot: "rcb", name: "로메로" },
      { slot: "lcb", name: "판 더 펜" },
      { slot: "lb", name: "우도기" },
      { slot: "rcm", name: "벤탄쿠르" },
      { slot: "cm", name: "비수마" },
      { slot: "lcm", name: "매디슨" },
      { slot: "rw", name: "존슨" },
      { slot: "st", name: "히샬리송" },
      { slot: "lw", name: "손흥민" },
    ],
  },
  {
    id: "realmadrid",
    league: "라리가",
    team: "레알 마드리드",
    formation: "433",
    players: [
      { slot: "gk", name: "쿠르투아" },
      { slot: "rb", name: "카르바할" },
      { slot: "rcb", name: "밀리탕" },
      { slot: "lcb", name: "뤼디거" },
      { slot: "lb", name: "멘디" },
      { slot: "rcm", name: "발베르데" },
      { slot: "cm", name: "추아메니" },
      { slot: "lcm", name: "벨링엄" },
      { slot: "rw", name: "로드리고" },
      { slot: "st", name: "음바페" },
      { slot: "lw", name: "비니시우스" },
    ],
  },
  {
    id: "barcelona",
    league: "라리가",
    team: "바르셀로나",
    formation: "433",
    players: [
      { slot: "gk", name: "테어 슈테겐" },
      { slot: "rb", name: "쿤데" },
      { slot: "rcb", name: "아라우호" },
      { slot: "lcb", name: "이니고 마르티네스" },
      { slot: "lb", name: "발데" },
      { slot: "rcm", name: "페드리" },
      { slot: "cm", name: "데 용" },
      { slot: "lcm", name: "가비" },
      { slot: "rw", name: "야말" },
      { slot: "st", name: "레반도프스키" },
      { slot: "lw", name: "하피냐" },
    ],
  },
];

export function getPreset(id: string): TeamPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** 리그별로 묶은 팀 목록 (선택 UI용) */
export function presetsByLeague(): { league: string; teams: TeamPreset[] }[] {
  const map = new Map<string, TeamPreset[]>();
  for (const p of PRESETS) {
    const arr = map.get(p.league) ?? [];
    arr.push(p);
    map.set(p.league, arr);
  }
  return [...map.entries()].map(([league, teams]) => ({ league, teams }));
}
