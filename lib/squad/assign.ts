import { FORMATIONS, type Slot } from "./formations";

type PosLine = "GK" | "DEF" | "MID" | "ATT";

const LINE_OF_POS: Record<string, PosLine> = {
  GK: "GK",
  LB: "DEF", RB: "DEF", CB: "DEF", LWB: "DEF", RWB: "DEF",
  CDM: "MID", CM: "MID", LM: "MID", RM: "MID",
  CAM: "MID", LAM: "MID", RAM: "MID",
  CF: "ATT", ST: "ATT", LW: "ATT", RW: "ATT",
};

export function posLineOf(pos: string): PosLine {
  return LINE_OF_POS[pos] ?? "MID";
}

// FC온라인 spposition 코드(0~27) → 포메이션 기본 라벨(측면 유지, 세부는 통합)
const CODE_BASE: Record<number, string> = {
  0: "GK",
  1: "CB", 2: "RWB", 3: "RB", 4: "CB", 5: "CB", 6: "CB", 7: "LB", 8: "LWB",
  9: "CDM", 10: "CDM", 11: "CDM",
  12: "RM", 13: "CM", 14: "CM", 15: "CM", 16: "LM",
  17: "RAM", 18: "CAM", 19: "LAM",
  20: "RW", 21: "CF", 22: "LW", 23: "RW", 24: "ST", 25: "ST", 26: "ST", 27: "LW",
};

export function baseLabelOfCode(code: number): string {
  return CODE_BASE[code] ?? "CM";
}

/**
 * 라인업(포지션 라벨 11개)에 가장 근접한 포메이션 id.
 * 점수 = 정확 포지션 일치 ×2 + 잔여 인원의 같은 라인 일치. 동점이면 목록 앞(4-3-3 계열) 우선.
 */
export function bestFormationId(labels: string[]): string {
  const playerCounts = new Map<string, number>();
  for (const l of labels) playerCounts.set(l, (playerCounts.get(l) ?? 0) + 1);

  let bestId = FORMATIONS[0].id;
  let bestScore = -1;

  for (const f of FORMATIONS) {
    const slotCounts = new Map<string, number>();
    for (const s of f.slots) slotCounts.set(s.pos, (slotCounts.get(s.pos) ?? 0) + 1);

    let exact = 0;
    const restByLine = new Map<PosLine, number>();
    for (const [label, n] of playerCounts) {
      const m = Math.min(n, slotCounts.get(label) ?? 0);
      exact += m;
      if (m > 0) slotCounts.set(label, (slotCounts.get(label) ?? 0) - m);
      const rest = n - m;
      if (rest > 0) {
        const line = posLineOf(label);
        restByLine.set(line, (restByLine.get(line) ?? 0) + rest);
      }
    }

    const slotRestByLine = new Map<PosLine, number>();
    for (const [pos, n] of slotCounts) {
      if (n <= 0) continue;
      const line = posLineOf(pos);
      slotRestByLine.set(line, (slotRestByLine.get(line) ?? 0) + n);
    }
    let lineScore = 0;
    for (const [line, n] of restByLine)
      lineScore += Math.min(n, slotRestByLine.get(line) ?? 0);

    const score = exact * 2 + lineScore;
    if (score > bestScore) {
      bestScore = score;
      bestId = f.id;
    }
  }
  return bestId;
}

export interface AssignInput {
  pos: string;
  name: string;
  spid?: number;
  season?: string;
}

/**
 * 선수 목록을 포메이션 슬롯에 배치.
 * 3단계: ① 정확 포지션 일치 → ② 같은 라인 → ③ 남는 슬롯.
 * 반환: slotId → 배치된 선수.
 */
export function assignByPosition(
  slots: Slot[],
  players: AssignInput[]
): Record<string, AssignInput> {
  const remaining = [...slots];
  const out: Record<string, AssignInput> = {};

  const take = (pred: (s: Slot) => boolean): Slot | null => {
    const i = remaining.findIndex(pred);
    return i < 0 ? null : remaining.splice(i, 1)[0];
  };

  // ① 정확 포지션
  const afterExact: AssignInput[] = [];
  for (const p of players) {
    const s = take((x) => x.pos === p.pos);
    if (s) out[s.id] = p;
    else afterExact.push(p);
  }
  // ② 같은 라인
  const afterLine: AssignInput[] = [];
  for (const p of afterExact) {
    const s = take((x) => posLineOf(x.pos) === posLineOf(p.pos));
    if (s) out[s.id] = p;
    else afterLine.push(p);
  }
  // ③ 남는 슬롯
  for (const p of afterLine) {
    const s = take(() => true);
    if (s) out[s.id] = p;
  }
  return out;
}
