import { getOuid } from '@/lib/nexon/api';
import { MATCH_TABS } from '@/lib/nexon/meta';
import { getRecentMatchDetails } from '@/lib/nexon/recent';
import { aggregatePlaystyle, analyzePlaystyle } from '@/lib/playstyle';
import { detectGoalCode } from '@/app/components/ShotMap';
import { decodeNickname, fanoutGuard, nexonErrorResponse, ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/v1/user/:nickname/playstyle?type=50 — 플레이스타일 아키타입 + 5축 + 누적 슛맵. */
export async function GET(req: Request, { params }: { params: Promise<{ nickname: string }> }) {
  const guard = fanoutGuard(req, 'v1-user');
  if (guard) return guard;
  const { nickname: raw } = await params;
  const nickname = decodeNickname(raw);
  const typeParam = Number(new URL(req.url).searchParams.get('type'));
  const matchType = MATCH_TABS.find((t) => t.type === typeParam)?.type ?? MATCH_TABS[0].type;
  try {
    const ouid = await getOuid(nickname);
    const { details } = await getRecentMatchDetails(ouid, matchType, 30);
    const result = analyzePlaystyle(aggregatePlaystyle(details, ouid));
    const shots: { x: number; y: number; isGoal: boolean; hitPost: boolean }[] = [];
    for (const d of details) {
      const mine = d.matchInfo?.find((e) => e.ouid === ouid);
      if (!mine) continue;
      const goalCode = detectGoalCode([
        { shots: mine.shootDetail ?? [], goals: mine.shoot?.goalTotalDisplay ?? mine.shoot?.goalTotal ?? 0 },
      ]);
      for (const s of mine.shootDetail ?? [])
        shots.push({ x: s.x, y: s.y, isGoal: goalCode !== null && s.result === goalCode, hitPost: s.hitPost });
    }
    return ok({ matchType, result, shots });
  } catch (err) {
    return nexonErrorResponse(err, nickname);
  }
}
