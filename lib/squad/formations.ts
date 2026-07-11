// 포메이션 정의 — 슬롯 좌표(x: 0~100 좌우, y: 0~100, 92=우리 골대 쪽 하단).
// 행(row) 기반으로 좌표를 자동 계산해 FC온라인 주요 포메이션 전체를 커버한다.
export interface Slot {
  id: string; // 안정 키
  pos: string; // 포지션 라벨 (GK, CB, ST ...)
  x: number;
  y: number;
}

export type Line = "4" | "3" | "5"; // 최종 수비 라인(백)

export interface Formation {
  id: string;
  name: string;
  line: Line; // 카테고리(수비 백 수)
  slots: Slot[];
}

/**
 * 행 배열(뒤→앞, 첫 행은 GK)로 슬롯을 생성.
 * y: GK=92, 필드 행은 78(수비)→16(공격) 선형 분포.
 * x: 행 내 인원 균등 분포 (j+1)/(k+1)*100, [8,92] 클램프.
 */
function build(rows: string[][]): Slot[] {
  const slots: Slot[] = [];
  const outRows = rows.length - 1; // GK 제외
  const counts: Record<string, number> = {};
  rows.forEach((row, ri) => {
    const y =
      ri === 0
        ? 92
        : outRows <= 1
          ? 20
          : Math.round(78 - (ri - 1) * (62 / (outRows - 1)));
    const k = row.length;
    row.forEach((pos, j) => {
      const x = Math.min(92, Math.max(8, Math.round(((j + 1) / (k + 1)) * 100)));
      const key = pos.toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
      const id = `${key}${counts[key]}`;
      slots.push({ id, pos, x, y });
    });
  });
  return slots;
}

interface Def {
  id: string;
  name: string;
  line: Line;
  rows: string[][];
}

// 뒤(수비)→앞(공격) 순서. 첫 행은 GK.
const DEFS: Def[] = [
  // ── 4백 ──
  { id: "433", name: "4-3-3", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["CM", "CM", "CM"], ["LW", "ST", "RW"]] },
  { id: "442", name: "4-4-2", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["LM", "CM", "CM", "RM"], ["ST", "ST"]] },
  { id: "4231", name: "4-2-3-1", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["CDM", "CDM"], ["LAM", "CAM", "RAM"], ["ST"]] },
  { id: "4141", name: "4-1-4-1", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["CDM"], ["LM", "CM", "CM", "RM"], ["ST"]] },
  { id: "4312", name: "4-3-1-2", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["CM", "CM", "CM"], ["CAM"], ["ST", "ST"]] },
  { id: "41212", name: "4-1-2-1-2", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["CDM"], ["LM", "RM"], ["CAM"], ["ST", "ST"]] },
  { id: "4222", name: "4-2-2-2", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["CDM", "CDM"], ["LAM", "RAM"], ["ST", "ST"]] },
  { id: "4411", name: "4-4-1-1", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["LM", "CM", "CM", "RM"], ["CF"], ["ST"]] },
  { id: "451", name: "4-5-1", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["LM", "CM", "CM", "CM", "RM"], ["ST"]] },
  { id: "4321", name: "4-3-2-1", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["CM", "CM", "CM"], ["CF", "CF"], ["ST"]] },
  { id: "424", name: "4-2-4", line: "4", rows: [["GK"], ["LB", "CB", "CB", "RB"], ["CM", "CM"], ["LW", "ST", "ST", "RW"]] },
  // ── 3백 ──
  { id: "352", name: "3-5-2", line: "3", rows: [["GK"], ["CB", "CB", "CB"], ["LWB", "CM", "CM", "CM", "RWB"], ["ST", "ST"]] },
  { id: "343", name: "3-4-3", line: "3", rows: [["GK"], ["CB", "CB", "CB"], ["LM", "CM", "CM", "RM"], ["LW", "ST", "RW"]] },
  { id: "3412", name: "3-4-1-2", line: "3", rows: [["GK"], ["CB", "CB", "CB"], ["LM", "CM", "CM", "RM"], ["CAM"], ["ST", "ST"]] },
  { id: "3142", name: "3-1-4-2", line: "3", rows: [["GK"], ["CB", "CB", "CB"], ["CDM"], ["LM", "CM", "CM", "RM"], ["ST", "ST"]] },
  { id: "3421", name: "3-4-2-1", line: "3", rows: [["GK"], ["CB", "CB", "CB"], ["LM", "CM", "CM", "RM"], ["CAM", "CAM"], ["ST"]] },
  // ── 5백 ──
  { id: "532", name: "5-3-2", line: "5", rows: [["GK"], ["LWB", "CB", "CB", "CB", "RWB"], ["CM", "CM", "CM"], ["ST", "ST"]] },
  { id: "541", name: "5-4-1", line: "5", rows: [["GK"], ["LWB", "CB", "CB", "CB", "RWB"], ["LM", "CM", "CM", "RM"], ["ST"]] },
  { id: "523", name: "5-2-3", line: "5", rows: [["GK"], ["LWB", "CB", "CB", "CB", "RWB"], ["CM", "CM"], ["LW", "ST", "RW"]] },
];

export const FORMATIONS: Formation[] = DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  line: d.line,
  slots: build(d.rows),
}));

export const LINE_LABEL: Record<Line, string> = {
  "4": "4백",
  "3": "3백",
  "5": "5백",
};

export const LINE_ORDER: Line[] = ["4", "3", "5"];

/** 카테고리(백)별 포메이션 목록 */
export function formationsByLine(): { line: Line; label: string; items: Formation[] }[] {
  return LINE_ORDER.map((line) => ({
    line,
    label: LINE_LABEL[line],
    items: FORMATIONS.filter((f) => f.line === line),
  }));
}

export function getFormation(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}
