import { getPlayerBySpid } from '@/lib/nexon/players';
import { getPlayerRankerMeta } from '@/lib/nexon/player-meta';
import { getPositionLabel } from '@/lib/nexon/meta';
import { playstyleOf } from '@/lib/nexon/playstyle';
import { apiError, ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

/** GET /api/v1/player/:spid — 선수 도감(시즌 변형 + 랭커 포지션별 실사용 스탯 + 플레이스타일). */
export async function GET(_req: Request, { params }: { params: Promise<{ spid: string }> }) {
  const { spid: raw } = await params;
  if (!/^\d{4,10}$/.test(raw)) return apiError('bad_request', '잘못된 선수 ID', 400);
  const spid = Number(raw);
  const [player, meta] = await Promise.all([getPlayerBySpid(spid).catch(() => null), getPlayerRankerMeta(spid)]);
  const positions = meta.positions.map((p) => ({
    ...p,
    positionLabel: getPositionLabel(p.position),
    passRate: p.passTry > 0 ? Math.round((p.passSuccess / p.passTry) * 100) : null,
    dribbleRate: p.dribbleTry > 0 ? Math.round((p.dribbleSuccess / p.dribbleTry) * 100) : null,
    playstyle: playstyleOf({
      goal: p.goal, assist: p.assist, passTry: p.passTry, passSuccess: p.passSuccess,
      dribbleTry: p.dribbleTry, dribbleSuccess: p.dribbleSuccess, tackle: p.tackle, block: p.block,
    }),
  }));
  return ok(
    {
      spid,
      name: player?.name ?? `선수 ${spid}`,
      // 같은 실선수의 대표 카드 시즌이 아니라 **요청한 spid 카드**의 시즌(예: PTG 카드인데 "26 TOTS"로 내려가던 문제).
      season: player?.seasons.find((s) => s.spid === spid)?.season ?? player?.season ?? '',
      pid: player?.pid ?? null,
      seasons: player?.seasons ?? [],
      imageUrl: `/api/player-image/${spid}`,
      ranker: { date: meta.date, totalMatches: meta.totalMatches, positions },
    },
    3600
  );
}
