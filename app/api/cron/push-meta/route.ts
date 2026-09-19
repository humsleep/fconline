import { NextResponse } from 'next/server';
import { loadPicks, pickTopMover, topMovers, LINE_TITLE } from '@/lib/meta/picks';
import { getPlayerNames } from '@/lib/nexon/players';
import { getPositionLabel } from '@/lib/nexon/meta';
import { apnsConfigured } from '@/lib/push/apns';
import { cronAuthorized, dispatch, loadDevices } from '@/lib/push/cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** 금요일 메타 요약 푸시 — 오늘의 급상승 1건 + 대세 카드 한 줄. 스냅샷 없으면 발송 안 함. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!apnsConfigured()) return NextResponse.json({ error: 'apns not configured' }, { status: 503 });
  const { date, byLine } = await loadPicks();
  const mover = pickTopMover(byLine);
  if (!date || !mover) return NextResponse.json({ sent: 0, reason: 'no snapshot' });
  const movers = topMovers(byLine, 3);
  const names = await getPlayerNames(movers.map((m) => m.spId));
  const name = (id: number) => names.get(id) ?? `선수 ${id}`;
  const rest = movers.filter((m) => m.spId !== mover.spId).slice(0, 2).map((m) => `${name(m.spId)}(${getPositionLabel(m.position)})`).join(', ');
  const devices = await loadDevices('meta');
  const r = await dispatch([
    {
      tokens: devices.map((d) => d.token),
      payload: {
        title: `⚡ 메타 급상승 — ${name(mover.spId)} ${mover.delta === null ? 'NEW 진입' : `전일 대비 ▲${mover.delta}`}`,
        body: `${LINE_TITLE[mover.line as keyof typeof LINE_TITLE] ?? mover.line} 급상승${rest ? ` · 함께 뜨는 카드: ${rest}` : ''}. 주말 스쿼드 점검은 픽 랭킹에서.`,
        link: 'https://www.fcscope.xyz/meta',
        collapseId: 'meta',
      },
    },
  ]);
  return NextResponse.json({ devices: devices.length, date, ...r });
}
