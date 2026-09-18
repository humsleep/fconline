import { FORMATIONS, getFormation } from "./formations";
import { bestFormationId } from "./assign";

/**
 * 스쿼드 포메이션 제목 — 앱(PitchLayout.Layout.title)과 같은 규칙.
 * 앱에서 자리를 끌어 옮기면 선수별 포지션(pos)이 저장된다. 11자리 라벨이 어떤 포메이션과 정확히 같으면 그 이름,
 * 아니면 "커스텀 (≈가장 가까운 포메이션)". 옮긴 자리가 없으면 저장된 포메이션 이름 그대로.
 */
export function squadFormationTitle(squad: { formation: string; slots: { slotId: string; pos?: string }[] }): string {
  const f = getFormation(squad.formation);
  const override = new Map<string, string>();
  for (const s of squad.slots) if (s.pos) override.set(s.slotId, s.pos);
  if (override.size === 0) return f.name;
  const labels = f.slots.map((s) => override.get(s.id) ?? s.pos);
  const key = (ls: string[]) => [...ls].sort().join(",");
  const want = key(labels);
  const exact = FORMATIONS.find((x) => key(x.slots.map((s) => s.pos)) === want);
  if (exact) return exact.name;
  return `커스텀 (≈${getFormation(bestFormationId(labels)).name})`;
}
