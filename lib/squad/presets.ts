// 리그 → 팀 프리셋 (큐레이션, 외부 API 키 불필요).
// 선수명은 spid.json에서 best-effort 매칭 → 못 찾으면 슬롯 비움(사용자가 채움).
// 커버리지 확장은 추후 API-Football(/players/squads) 연동으로.

export interface PresetPlayer {
  pos: string; // 포지션 라벨 (GK, CB, ST ...)
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
      { pos: "GK", name: "라야" },
      { pos: "RB", name: "화이트" },
      { pos: "CB", name: "살리바" },
      { pos: "CB", name: "가브리엘" },
      { pos: "LB", name: "진첸코" },
      { pos: "CM", name: "라이스" },
      { pos: "CM", name: "외데고르" },
      { pos: "CM", name: "하베르츠" },
      { pos: "RW", name: "사카" },
      { pos: "ST", name: "제주스" },
      { pos: "LW", name: "마르티넬리" },
    ],
  },
  {
    id: "mancity",
    league: "프리미어리그",
    team: "맨체스터 시티",
    formation: "433",
    players: [
      { pos: "GK", name: "에데르송" },
      { pos: "RB", name: "워커" },
      { pos: "CB", name: "디아스" },
      { pos: "CB", name: "그바르디올" },
      { pos: "LB", name: "아케" },
      { pos: "CM", name: "로드리" },
      { pos: "CM", name: "데 브라위너" },
      { pos: "CM", name: "베르나르두 실바" },
      { pos: "RW", name: "포든" },
      { pos: "ST", name: "홀란드" },
      { pos: "LW", name: "도쿠" },
    ],
  },
  {
    id: "liverpool",
    league: "프리미어리그",
    team: "리버풀",
    formation: "433",
    players: [
      { pos: "GK", name: "알리송" },
      { pos: "RB", name: "알렉산더-아놀드" },
      { pos: "CB", name: "코나테" },
      { pos: "CB", name: "반 다이크" },
      { pos: "LB", name: "로버트슨" },
      { pos: "CM", name: "맥 알리스터" },
      { pos: "CM", name: "그라벤베르흐" },
      { pos: "CM", name: "소보슬라이" },
      { pos: "RW", name: "살라" },
      { pos: "ST", name: "누녜스" },
      { pos: "LW", name: "디아스" },
    ],
  },
  {
    id: "tottenham",
    league: "프리미어리그",
    team: "토트넘",
    formation: "433",
    players: [
      { pos: "GK", name: "비카리오" },
      { pos: "RB", name: "포로" },
      { pos: "CB", name: "로메로" },
      { pos: "CB", name: "판 더 펜" },
      { pos: "LB", name: "우도기" },
      { pos: "CM", name: "벤탄쿠르" },
      { pos: "CM", name: "비수마" },
      { pos: "CM", name: "매디슨" },
      { pos: "RW", name: "존슨" },
      { pos: "ST", name: "히샬리송" },
      { pos: "LW", name: "손흥민" },
    ],
  },
  {
    id: "realmadrid",
    league: "라리가",
    team: "레알 마드리드",
    formation: "433",
    players: [
      { pos: "GK", name: "쿠르투아" },
      { pos: "RB", name: "카르바할" },
      { pos: "CB", name: "밀리탕" },
      { pos: "CB", name: "뤼디거" },
      { pos: "LB", name: "멘디" },
      { pos: "CM", name: "발베르데" },
      { pos: "CM", name: "추아메니" },
      { pos: "CM", name: "벨링엄" },
      { pos: "RW", name: "로드리고" },
      { pos: "ST", name: "음바페" },
      { pos: "LW", name: "비니시우스" },
    ],
  },
  {
    id: "barcelona",
    league: "라리가",
    team: "바르셀로나",
    formation: "433",
    players: [
      { pos: "GK", name: "테어 슈테겐" },
      { pos: "RB", name: "쿤데" },
      { pos: "CB", name: "아라우호" },
      { pos: "CB", name: "이니고 마르티네스" },
      { pos: "LB", name: "발데" },
      { pos: "CM", name: "페드리" },
      { pos: "CM", name: "데 용" },
      { pos: "CM", name: "가비" },
      { pos: "RW", name: "야말" },
      { pos: "ST", name: "레반도프스키" },
      { pos: "LW", name: "하피냐" },
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
