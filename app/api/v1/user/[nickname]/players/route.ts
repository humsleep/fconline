import { getOuid } from '@/lib/nexon/api';
import { MATCH_TABS, getPositionLabel } from '@/lib/nexon/meta';
import { getRecentMatchDetails } from '@/lib/nexon/recent';
import { aggregatePlayers } from '@/lib/nexon/player-stats';
import { getPlayerNames, getSeasonNames } from '@/lib/nexon/players';
import { getRankerStatsCached, rankerKey, type RankerMap } from '@/lib/nexon/ranker';
import { loadPicks, topPickIdsByLine, isTopPick } from '@/lib/meta/picks';
import { verdictFromRating } from '@/lib/verdict';
import { diagnoseSquad } from '@/lib/squad-clinic';
import { decodeNickname, fanoutGuard, nexonErrorResponse, ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_CARDS = 18;
const MIN_GAMES = 2;

/** GET /api/v1/user/:nickname/players?type=50 — 선수 성적표 + 랭커 벤치마크 + 클리닉 + 판정. */
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
    const all = aggregatePlayers(details, ouid);
    const players = all.filter((p) => p.games >= MIN_GAMES).slice(0, MAX_CARDS);

    let ranker: RankerMap = new Map();
    try {
      ranker = await getRankerStatsCached(matchType, players.map((p) => ({ id: p.spId, po: p.mainPosition })));
    } catch {
      // 랭커 없이도 표시
    }
    const [names, seasons] = await Promise.all([
      getPlayerNames(players.map((p) => p.spId)),
      getSeasonNames(players.map((p) => p.spId)),
    ]);

    let idsByLine = new Map<string, Set<number>>();
    let pickDate: string | null = null;
    try {
      const picks = await loadPicks(matchType, false);
      idsByLine = topPickIdsByLine(picks.byLine, 10);
      if ([...idsByLine.values()].some((s) => s.size > 0)) pickDate = picks.date;
    } catch {
      // 스냅샷 없음
    }
    const hasPickData = pickDate !== null;
    const clinic = diagnoseSquad(players, () => undefined);
    const totalGames = players.reduce((s, p) => s + p.games, 0);
    const squadRating =
      clinic?.squadRating ?? (totalGames > 0 ? players.reduce((s, p) => s + p.avgRating * p.games, 0) / totalGames : 0);

    const cards = players.map((p) => {
      const st = ranker.get(rankerKey(p.spId, p.mainPosition))?.status;
      const rankerCmp =
        st && (st.matchCount ?? 0) > 0
          ? {
              goal: Math.round((st.goal ?? 0) * 100) / 100,
              passRate: (st.passTry ?? 0) > 0 ? Math.round(((st.passSuccess ?? 0) / (st.passTry ?? 1)) * 100) : 0,
              matchCount: st.matchCount ?? 0,
            }
          : null;
      return {
        ...p,
        name: names.get(p.spId) ?? `선수 ${p.spId}`,
        season: seasons.get(p.spId) ?? '',
        positionLabel: getPositionLabel(p.mainPosition),
        imageUrl: `/api/player-image/${p.spId}`,
        verdict: verdictFromRating({ rating: p.avgRating, subjectType: 'player', seed: String(p.spId) }),
        ranker: rankerCmp,
        topPick: hasPickData && isTopPick(idsByLine, p.spId, p.mainPosition),
      };
    });

    return ok({
      matchType,
      sampleGames: details.length,
      minGames: MIN_GAMES,
      squadRating: Math.round(squadRating * 100) / 100,
      squadVerdict: players.length > 0 ? verdictFromRating({ rating: squadRating, subjectType: 'player', seed: 'squad' }) : null,
      clinic,
      picks: hasPickData
        ? { date: pickDate, topPickCount: cards.filter((c) => c.topPick).length, total: cards.length, cardUrl: `/api/card/pickmatch/${encodeURIComponent(nickname)}?mt=${matchType}` }
        : null,
      players: cards,
      builderOwner: nickname,
    });
  } catch (err) {
    return nexonErrorResponse(err, nickname);
  }
}
