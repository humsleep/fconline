import { getMaxDivisions, getOuid, getUserBasic } from '@/lib/nexon/api';
import { MATCH_TABS, getDivisionName, getMatchTypeName } from '@/lib/nexon/meta';
import { divisionIconUrl } from '@/lib/nexon/division-icon';
import { getRecentMatchDetails } from '@/lib/nexon/recent';
import { aggregate, pickNemesis, summarizeMatch, topRivals, type MatchSummary } from '@/lib/nexon/summary';
import { matchScore, recentScore, scoreTier } from '@/lib/nexon/score';
import { hasStreakHighlight, streakLabel } from '@/lib/nexon/streak-card';
import { weeklyRecap } from '@/lib/nexon/weekly';
import { computeMatchPerfStats, diagnoseMatchPerf } from '@/lib/match/diagnosis';
import { formatAchievementDate } from '@/lib/format';
import { logNicknameSearch } from '@/lib/search-log';
import { decodeNickname, fanoutGuard, nexonErrorResponse, ok, serializeRule } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MATCH_COUNT = 30;

/**
 * GET /api/v1/user/:nickname?type=50
 * 전적 페이지 '경기 기록' 탭 + 히어로에 필요한 모든 것을 한 번에 (앱 첫 화면 1왕복).
 */
export async function GET(req: Request, { params }: { params: Promise<{ nickname: string }> }) {
  const guard = fanoutGuard(req, 'v1-user');
  if (guard) return guard;
  const { nickname: raw } = await params;
  const nickname = decodeNickname(raw);
  const sp = new URL(req.url).searchParams;
  const typeParam = Number(sp.get('type'));
  const matchType = MATCH_TABS.find((t) => t.type === typeParam)?.type ?? MATCH_TABS[0].type;
  // 2단계 조회: 앱이 콜드 조회에서 히어로를 먼저 그리도록 프로필만 반환(넥슨 2콜, 팬아웃 없음).
  const profileOnly = sp.get('stage') === 'profile';

  let ouid: string;
  let basic: Awaited<ReturnType<typeof getUserBasic>>;
  let divisions: Awaited<ReturnType<typeof getMaxDivisions>> = [];
  try {
    ouid = await getOuid(nickname);
    const [b, d] = await Promise.all([getUserBasic(ouid), getMaxDivisions(ouid).catch(() => [])]);
    basic = b;
    divisions = d;
  } catch (err) {
    return nexonErrorResponse(err, nickname);
  }
  logNicknameSearch(basic.nickname, req.headers.get('user-agent'));

  const divisionCards = await Promise.all(
    divisions.slice(0, 3).map(async (d) => ({
      matchType: d.matchType,
      matchTypeName: await getMatchTypeName(d.matchType),
      division: d.division,
      divisionName: await getDivisionName(d.division),
      date: formatAchievementDate(d.achievementDate),
      iconUrl: divisionIconUrl(d.division),
    }))
  );

  if (profileOnly) {
    return ok({ profile: { ouid, nickname: basic.nickname, level: basic.level, divisions: divisionCards } });
  }

  const recent = await getRecentMatchDetails(ouid, matchType, MATCH_COUNT).catch(() => null);

  const summaries: MatchSummary[] = [];
  if (recent) {
    for (const d of recent.details) {
      const s = summarizeMatch(d, ouid);
      if (s) summaries.push(s);
    }
  }
  const rec = aggregate(summaries);
  const perf = computeMatchPerfStats(summaries);
  const diagnosis = diagnoseMatchPerf(perf);
  const rivals = topRivals(summaries);
  const nemesis = pickNemesis(rivals);
  const week = weeklyRecap(summaries);
  // 30경기 상한에 걸렸고 가장 오래된 경기도 7일 안이면 "최근 7일"이 실제로는 "최근 30경기"다 — 앱이 문구를 바꾸게 알린다.
  const oldest = summaries.length ? Math.min(...summaries.map((s) => Date.parse(s.matchDate.endsWith('Z') ? s.matchDate : `${s.matchDate}Z`))) : NaN;
  const weekTruncated = summaries.length >= MATCH_COUNT && !Number.isNaN(oldest) && Date.now() - oldest < 7 * 86_400_000;
  const score = recentScore(summaries);
  const tier = scoreTier(score);
  const streak = streakLabel(perf);
  const ratings = summaries.map((m) => m.me.rating).filter((r) => r > 0);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  return ok({
    profile: { ouid, nickname: basic.nickname, level: basic.level, divisions: divisionCards },
    matchType,
    matchTabs: MATCH_TABS.map((t) => ({ type: t.type, label: t.label })),
    listOk: recent?.listOk ?? false,
    requested: recent?.matchIds.length ?? 0,
    loaded: recent?.details.length ?? 0,
    summary: rec,
    avgRating: Math.round(avgRating * 100) / 100,
    score,
    tier,
    streak: { ...streak, highlight: hasStreakHighlight(perf) },
    perf,
    diagnosis: { type: serializeRule(diagnosis.type), notes: diagnosis.notes.map((n) => serializeRule(n)) },
    week: { ...week, truncated: weekTruncated },
    rivals,
    nemesis,
    matches: summaries.map((m) => ({ ...m, score: matchScore(m) })),
    cards: {
      user: `/api/card/user/${encodeURIComponent(basic.nickname)}`,
      rank: divisionCards.length > 0 ? `/api/card/rank/${encodeURIComponent(basic.nickname)}` : null,
      streak: `/api/card/streak/${encodeURIComponent(basic.nickname)}`,
      weekly: `/api/card/weekly/${encodeURIComponent(basic.nickname)}`,
      rival: nemesis ? `/api/card/rival/${encodeURIComponent(basic.nickname)}` : null,
    },
  });
}
