import { getMatchDetailCached } from '@/lib/nexon/cached';
import { NexonApiError } from '@/lib/nexon/client';
import { MATCH_ID_RE } from '@/lib/nexon/errors';
import { getMatchTypeName, getPositionLabel } from '@/lib/nexon/meta';
import { getPlayerNames } from '@/lib/nexon/players';
import { detectGoalCode } from '@/app/components/ShotMap';
import { verdictFromMatch } from '@/lib/verdict';
import { goalMinute } from '@/lib/nexon/goal-time';
import { formatMatchDate } from '@/lib/format';
import type { MatchInfoEntry } from '@/lib/nexon/types';
import { apiError, fanoutGuard, nexonErrorResponse, ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

function side(e: MatchInfoEntry, goalCode: number | null, names: Map<number, string>) {
  const passTry = e.pass?.passTry ?? 0;
  const passSuccess = e.pass?.passSuccess ?? 0;
  return {
    ouid: e.ouid,
    nickname: e.nickname,
    result: e.matchDetail?.matchResult ?? '?',
    forfeit: (e.matchDetail?.matchEndType ?? 0) !== 0,
    goals: e.shoot?.goalTotalDisplay ?? e.shoot?.goalTotal ?? 0,
    possession: e.matchDetail?.possession ?? 50,
    rating: e.matchDetail?.averageRating ?? 0,
    controller: e.matchDetail?.controller ?? '',
    stats: {
      shots: e.shoot?.shootTotal ?? 0,
      effectiveShots: e.shoot?.effectiveShootTotal ?? 0,
      passTry,
      passSuccess,
      passRate: passTry ? Math.round((passSuccess / passTry) * 100) : null,
      dribble: e.matchDetail?.dribble ?? 0,
      tackleTry: e.defence?.tackleTry ?? 0,
      tackleSuccess: e.defence?.tackleSuccess ?? 0,
      cornerKick: e.matchDetail?.cornerKick ?? 0,
      foul: e.matchDetail?.foul ?? 0,
      yellowCards: e.matchDetail?.yellowCards ?? 0,
      redCards: e.matchDetail?.redCards ?? 0,
      offside: e.matchDetail?.offsideCount ?? 0,
    },
    shots: (e.shootDetail ?? []).map((s) => ({
      x: s.x,
      y: s.y,
      // goalTime 은 하프 비트(2^24)가 실린 값 — /60 을 그대로 쓰면 후반 슛이 279,629분이 된다.
      minute: goalMinute(s.goalTime),
      spId: s.spId,
      player: names.get(s.spId) ?? String(s.spId),
      isGoal: goalCode !== null && s.result === goalCode,
      hitPost: s.hitPost,
      inPenalty: s.inPenalty,
    })),
    players: (e.player ?? [])
      .filter((p) => (p.status?.spRating ?? 0) > 0)
      .sort((a, b) => (b.status?.spRating ?? 0) - (a.status?.spRating ?? 0))
      .slice(0, 14)
      .map((p) => ({
        spId: p.spId,
        name: names.get(p.spId) ?? String(p.spId),
        position: p.spPosition,
        positionLabel: getPositionLabel(p.spPosition),
        rating: p.status?.spRating ?? 0,
        goals: p.status?.goal ?? 0,
        assists: p.status?.assist ?? 0,
        imageUrl: `/api/player-image/${p.spId}`,
      })),
  };
}

/** GET /api/v1/match/:matchId?me=<ouid> — 매치 리포트(스코어보드·슛맵·팀 스탯·평점·POTM·판정). */
export async function GET(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const guard = fanoutGuard(req, 'v1-match');
  if (guard) return guard;
  const { matchId } = await params;
  // 형식이 틀린 ID 는 넥슨을 부르지 않는다(넥슨은 400 "파라미터 오류"를 줘 502 로 떨어졌다).
  if (!MATCH_ID_RE.test(matchId)) return apiError('bad_request', '잘못된 매치 ID예요.', 400);
  const me = new URL(req.url).searchParams.get('me');
  let detail;
  try {
    detail = await getMatchDetailCached(matchId);
  } catch (err) {
    if (err instanceof NexonApiError && err.code === 'OPENAPI00003')
      return apiError('not_found', '매치를 찾을 수 없어요.', 404);
    return nexonErrorResponse(err);
  }
  const info = detail.matchInfo ?? [];
  if (info.length === 0) return apiError('not_found', '매치 정보가 없어요.', 404);
  const mine = info.find((e) => e.ouid === me) ?? info[0];
  const opp = info.find((e) => e !== mine) ?? null;
  const goalCode = detectGoalCode(
    [mine, ...(opp ? [opp] : [])].map((e) => ({
      shots: e.shootDetail ?? [],
      goals: e.shoot?.goalTotalDisplay ?? e.shoot?.goalTotal ?? 0,
    }))
  );
  const spIds = new Set<number>();
  for (const e of info) {
    for (const p of e.player ?? []) spIds.add(p.spId);
    for (const s of e.shootDetail ?? []) spIds.add(s.spId);
  }
  const [names, matchTypeName] = await Promise.all([getPlayerNames([...spIds]), getMatchTypeName(detail.matchType)]);

  const rated = info.flatMap((e) =>
    (e.player ?? []).filter((p) => (p.status?.spRating ?? 0) > 0).map((p) => ({ p, side: e.nickname }))
  );
  const potmRaw = rated.sort((a, b) => (b.p.status?.spRating ?? 0) - (a.p.status?.spRating ?? 0))[0];
  const potm = potmRaw
    ? {
        spId: potmRaw.p.spId,
        name: names.get(potmRaw.p.spId) ?? String(potmRaw.p.spId),
        positionLabel: getPositionLabel(potmRaw.p.spPosition),
        side: potmRaw.side,
        rating: potmRaw.p.status?.spRating ?? 0,
        imageUrl: `/api/player-image/${potmRaw.p.spId}`,
      }
    : null;

  return ok(
    {
      matchId: detail.matchId,
      matchDate: detail.matchDate,
      matchDateLabel: formatMatchDate(detail.matchDate),
      matchType: detail.matchType,
      matchTypeName,
      me: side(mine, goalCode, names),
      opponent: opp ? side(opp, goalCode, names) : null,
      verdict: verdictFromMatch({ result: mine.matchDetail?.matchResult ?? '?', myRating: mine.matchDetail?.averageRating ?? 0, seed: detail.matchId }),
      potm,
      cardUrl: `/api/card/match/${encodeURIComponent(matchId)}?me=${encodeURIComponent(mine.ouid)}`,
    },
    // 끝난 경기는 불변 — 엣지에서 1년 캐시(재계산 사실상 0). 웹 카드 라우트와 동일 정책.
    31_536_000
  );
}
