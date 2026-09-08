import { getPlayerNames, getSeasonNames } from '@/lib/nexon/players';
import { getPositionLabel } from '@/lib/nexon/meta';
import { loadPicks, pickTopMover, topMovers, LINE_TITLE } from '@/lib/meta/picks';
import { ok } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

const LINE_ORDER = ['ATT', 'MID', 'DEF', 'GK'] as const;

/** GET /api/v1/meta?type=50 — 랭커 픽 랭킹(라인별 TOP10) + 오늘의 급상승. */
export async function GET(req: Request) {
  const typeParam = Number(new URL(req.url).searchParams.get('type'));
  const matchType = typeParam === 52 ? 52 : 50;
  const { date, byLine } = await loadPicks(matchType);
  const allIds = [...byLine.values()].flat().map((r) => r.spId);
  const [names, seasons] = await Promise.all([getPlayerNames(allIds), getSeasonNames(allIds)]);
  const decorate = (spId: number, position: number) => ({
    name: names.get(spId) ?? `선수 ${spId}`,
    season: seasons.get(spId) ?? '',
    positionLabel: getPositionLabel(position),
    imageUrl: `/api/player-image/${spId}`,
  });
  const mover = pickTopMover(byLine);
  return ok(
    {
      matchType,
      date,
      mover: mover ? { ...mover, ...decorate(mover.spId, mover.position), lineTitle: LINE_TITLE[mover.line as keyof typeof LINE_TITLE] ?? mover.line } : null,
      movers: topMovers(byLine, 6).map((m) => ({ ...m, ...decorate(m.spId, m.position) })),
      lines: LINE_ORDER.map((line) => ({
        line,
        title: LINE_TITLE[line] ?? line,
        rows: (byLine.get(line) ?? []).slice(0, 10).map((r) => ({ ...r, ...decorate(r.spId, r.position) })),
      })).filter((l) => l.rows.length > 0),
    },
    1800
  );
}
