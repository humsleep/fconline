import type { Squad, SquadSlot } from './store';
import { getFormation } from './formations';

/**
 * 스쿼드 카드 '핵심 선수' 선정.
 * 버그 수정: 이전엔 slots 배열 순서 앞 2명(대개 GK·수비수)을 뽑아 공격수 대신
 * 골키퍼가 대표로 박혔다. 이제 공격 포지션 우선(작을수록 공격인 y 좌표)으로 정렬해 뽑는다.
 * 자유 배치 좌표(slot.y)가 있으면 그것을, 없으면 포메이션 기본 슬롯 y를 사용.
 */
export function pickKeyPlayers(squad: Squad, count = 2): string[] {
  const formation = getFormation(squad.formation);
  const yById = new Map(formation.slots.map((s) => [s.id, s.y]));
  const yOf = (s: SquadSlot): number =>
    typeof s.y === 'number' ? s.y : yById.get(s.slotId) ?? 50;

  return [...squad.slots]
    .filter((s) => s.name && s.name.trim().length > 0)
    .sort((a, b) => yOf(a) - yOf(b)) // 공격(작은 y) 먼저
    .slice(0, count)
    .map((s) => s.name);
}

/** 최다 시즌 구성 (동수면 먼저 집계된 시즌). seasonNames는 spid→시즌명 폴백. */
export function topSeason(
  squad: Squad,
  seasonNames: Map<number, string>
): { season: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const s of squad.slots) {
    const key = s.season ?? seasonNames.get(s.spid) ?? '';
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { season: top[0], count: top[1] } : null;
}
