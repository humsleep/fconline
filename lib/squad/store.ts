import 'server-only';

import { getAdmin } from '@/lib/supabase/admin';
import { resolvePlayer } from '@/lib/nexon/players';
import { getFormation } from './formations';
import { getPreset } from './presets';
import { assignByPosition, type AssignInput } from './assign';

export interface SquadSlot {
  slotId: string;
  spid: number;
  name: string;
  season?: string; // 시즌(클래스). spid에서 파생 가능이라 저장은 선택
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

const DAILY_SAVE_LIMIT = 20;

export async function saveSquad(input: {
  name: string;
  formation: string;
  slots: SquadSlot[];
  teamTag?: string | null;
  ipHash?: string | null;
  userId?: string | null; // 로그인 시 계정 귀속(크로스기기)
}): Promise<string | null | 'rate_limited'> {
  const db = getAdmin();
  if (!db) return null;

  // IP당 일일 저장 한도 (무인증 저장 어뷰징 방지)
  if (input.ipHash) {
    try {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await db
        .from('squads')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', input.ipHash)
        .gte('created_at', since);
      if ((count ?? 0) >= DAILY_SAVE_LIMIT) return 'rate_limited';
    } catch {
      // 카운트 실패 시 저장은 허용(가용성 우선)
    }
  }

  const id = shortId();
  try {
    const { error } = await db.from('squads').insert({
      id,
      name: input.name.slice(0, 40),
      formation: input.formation,
      slots: input.slots,
      team_tag: input.teamTag ?? null,
      ip_hash: input.ipHash ?? null,
      user_id: input.userId ?? null,
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

/** 로그인 계정에 귀속된 내 스쿼드 목록(최신순) — /me 크로스기기 표시용. */
export async function listUserSquads(
  userId: string,
  limit = 12
): Promise<{ id: string; name: string; formation: string; createdAt?: string }[]> {
  const db = getAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from('squads')
      .select('id, name, formation, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      formation: s.formation as string,
      createdAt: s.created_at as string,
    }));
  } catch {
    return [];
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

  // 이름 → spid 해석(넥슨 호출 아님, spid.json 메모이즈) 후 포지션 기반 배치
  const resolved: AssignInput[] = [];
  for (const p of preset.players) {
    const hit = await resolvePlayer(p.name);
    if (hit)
      resolved.push({ pos: p.pos, name: hit.name, spid: hit.spid, season: hit.season });
  }
  const placed = assignByPosition(formation.slots, resolved);
  const slots: SquadSlot[] = Object.entries(placed).map(([slotId, v]) => ({
    slotId,
    spid: v.spid!,
    name: v.name,
    season: v.season,
  }));

  return {
    formation: preset.formation,
    name: `${preset.team} 스쿼드`,
    teamTag: preset.id,
    slots,
  };
}
