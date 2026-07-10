import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import { resolvePlayer } from '@/lib/nexon/players';
import { getFormation } from './formations';
import { getPreset } from './presets';

export interface SquadSlot {
  slotId: string;
  spid: number;
  name: string;
  x?: number; // 커스텀 포메이션 좌표(0~100). 없으면 포메이션 기본 좌표 사용
  y?: number;
}

export interface Squad {
  id: string;
  name: string;
  formation: string;
  slots: SquadSlot[];
  teamTag: string | null;
  createdAt?: string;
}

// 짧은 공유 코드 (crypto.randomUUID 기반, Math.random 미사용)
function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export async function saveSquad(input: {
  name: string;
  formation: string;
  slots: SquadSlot[];
  teamTag?: string | null;
}): Promise<string | null> {
  const db = getAdmin();
  if (!db) return null;

  const id = shortId();
  try {
    const { error } = await db.from('squads').insert({
      id,
      name: input.name.slice(0, 40),
      formation: input.formation,
      slots: input.slots,
      team_tag: input.teamTag ?? null,
    });
    if (error) return null;
    return id;
  } catch {
    return null;
  }
}

export async function getSquad(id: string): Promise<Squad | null> {
  const db = getAdmin();
  if (!db) return null;
  try {
    const { data } = await db
      .from('squads')
      .select('id, name, formation, slots, team_tag, created_at')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      formation: data.formation,
      slots: (data.slots as SquadSlot[]) ?? [],
      teamTag: data.team_tag ?? null,
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

/** 팀 프리셋 → 슬롯 채우기 (이름을 spid로 best-effort 해석). 못 찾으면 슬롯 생략. */
export async function resolvePreset(presetId: string): Promise<{
  formation: string;
  name: string;
  teamTag: string;
  slots: SquadSlot[];
} | null> {
  const preset = getPreset(presetId);
  if (!preset) return null;

  const formation = getFormation(preset.formation);
  const validSlotIds = new Set(formation.slots.map((s) => s.id));

  const slots: SquadSlot[] = [];
  // 넥슨 순차 큐/캐시 부담 없음 — resolvePlayer는 spid.json(메모이즈) 조회
  for (const p of preset.players) {
    if (!validSlotIds.has(p.slot)) continue;
    const hit = await resolvePlayer(p.name);
    if (hit) slots.push({ slotId: p.slot, spid: hit.spid, name: hit.name });
  }

  return {
    formation: preset.formation,
    name: `${preset.team} 스쿼드`,
    teamTag: preset.id,
    slots,
  };
}
