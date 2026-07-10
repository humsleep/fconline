// 포메이션 정의 — 슬롯 좌표(x: 0~100 좌우, y: 0~100, 100=우리 골대 쪽 하단).
export interface Slot {
  id: string; // 안정 키
  pos: string; // 포지션 라벨 (GK, CB, ST ...)
  x: number;
  y: number;
}

export interface Formation {
  id: string;
  name: string;
  slots: Slot[];
}

const F433: Slot[] = [
  { id: "gk", pos: "GK", x: 50, y: 92 },
  { id: "lb", pos: "LB", x: 16, y: 72 },
  { id: "lcb", pos: "CB", x: 38, y: 78 },
  { id: "rcb", pos: "CB", x: 62, y: 78 },
  { id: "rb", pos: "RB", x: 84, y: 72 },
  { id: "lcm", pos: "CM", x: 30, y: 52 },
  { id: "cm", pos: "CM", x: 50, y: 56 },
  { id: "rcm", pos: "CM", x: 70, y: 52 },
  { id: "lw", pos: "LW", x: 20, y: 24 },
  { id: "st", pos: "ST", x: 50, y: 18 },
  { id: "rw", pos: "RW", x: 80, y: 24 },
];

const F442: Slot[] = [
  { id: "gk", pos: "GK", x: 50, y: 92 },
  { id: "lb", pos: "LB", x: 16, y: 72 },
  { id: "lcb", pos: "CB", x: 38, y: 78 },
  { id: "rcb", pos: "CB", x: 62, y: 78 },
  { id: "rb", pos: "RB", x: 84, y: 72 },
  { id: "lm", pos: "LM", x: 18, y: 48 },
  { id: "lcm", pos: "CM", x: 40, y: 52 },
  { id: "rcm", pos: "CM", x: 60, y: 52 },
  { id: "rm", pos: "RM", x: 82, y: 48 },
  { id: "lst", pos: "ST", x: 38, y: 20 },
  { id: "rst", pos: "ST", x: 62, y: 20 },
];

const F4231: Slot[] = [
  { id: "gk", pos: "GK", x: 50, y: 92 },
  { id: "lb", pos: "LB", x: 16, y: 72 },
  { id: "lcb", pos: "CB", x: 38, y: 78 },
  { id: "rcb", pos: "CB", x: 62, y: 78 },
  { id: "rb", pos: "RB", x: 84, y: 72 },
  { id: "ldm", pos: "CDM", x: 38, y: 58 },
  { id: "rdm", pos: "CDM", x: 62, y: 58 },
  { id: "lam", pos: "LAM", x: 20, y: 36 },
  { id: "cam", pos: "CAM", x: 50, y: 34 },
  { id: "ram", pos: "RAM", x: 80, y: 36 },
  { id: "st", pos: "ST", x: 50, y: 16 },
];

const F352: Slot[] = [
  { id: "gk", pos: "GK", x: 50, y: 92 },
  { id: "lcb", pos: "CB", x: 30, y: 78 },
  { id: "ccb", pos: "CB", x: 50, y: 80 },
  { id: "rcb", pos: "CB", x: 70, y: 78 },
  { id: "lwb", pos: "LWB", x: 12, y: 54 },
  { id: "lcm", pos: "CM", x: 36, y: 52 },
  { id: "cm", pos: "CM", x: 50, y: 56 },
  { id: "rcm", pos: "CM", x: 64, y: 52 },
  { id: "rwb", pos: "RWB", x: 88, y: 54 },
  { id: "lst", pos: "ST", x: 38, y: 20 },
  { id: "rst", pos: "ST", x: 62, y: 20 },
];

export const FORMATIONS: Formation[] = [
  { id: "433", name: "4-3-3", slots: F433 },
  { id: "442", name: "4-4-2", slots: F442 },
  { id: "4231", name: "4-2-3-1", slots: F4231 },
  { id: "352", name: "3-5-2", slots: F352 },
];

export function getFormation(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}
