import { getOuid } from '@/lib/nexon/api';
import { MATCH_TABS } from '@/lib/nexon/meta';
import { getRecentMatchDetails } from '@/lib/nexon/recent';
import { aggregateReport, reportInsights } from '@/lib/nexon/report';
import { decodeNickname, fanoutGuard, nexonErrorResponse, ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/v1/user/:nickname/report?type=50 — 종합 리포트(시간대별 득실·슛 타입·폼·인사이트). */
export async function GET(req: Request, { params }: { params: Promise<{ nickname: string }> }) {
  const guard = fanoutGuard(req, 'v1-user');
  if (guard) return guard;
  const { nickname: raw } = await params;
  const nickname = decodeNickname(raw);
  const typeParam = Number(new URL(req.url).searchParams.get('type'));
  const matchType = MATCH_TABS.find((t) => t.type === typeParam)?.type ?? MATCH_TABS[0].type;
  try {
    const ouid = await getOuid(nickname);
    const { listOk, details } = await getRecentMatchDetails(ouid, matchType, 30);
    const report = aggregateReport(details, ouid);
    return ok({ matchType, listOk, report, insights: report.played > 0 ? reportInsights(report) : [] });
  } catch (err) {
    return nexonErrorResponse(err, nickname);
  }
}
