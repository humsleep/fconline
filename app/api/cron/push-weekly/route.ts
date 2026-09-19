import { NextResponse } from 'next/server';
import { getOuid, getUserMatches } from '@/lib/nexon/api';
import { getMatchDetailsBatch } from '@/lib/nexon/cached';
import { summarizeMatch, type MatchSummary } from '@/lib/nexon/summary';
import { weeklyRecap } from '@/lib/nexon/weekly';
import { apnsConfigured } from '@/lib/push/apns';
import { cronAuthorized, dispatch, loadDevices } from '@/lib/push/cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 주간 리캡 푸시 — 일요일 밤(KST 21시) 크론. 기기의 '내 구단' 닉네임별로 최근 7일 성적을 계산해 1통.
 * 넥슨 팬아웃을 줄이기 위해 닉네임당 최근 20경기만, 같은 닉네임은 1회 조회. 주 3경기 미만이면 발송 안 함(빈 알림 금지).
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!apnsConfigured()) return NextResponse.json({ error: 'apns not configured' }, { status: 503 });
  const devices = await loadDevices('weekly');
  const byNick = new Map<string, string[]>();
  for (const d of devices) {
    const n = d.nickname?.trim();
    if (!n) continue;
    byNick.set(n.toLowerCase(), [...(byNick.get(n.toLowerCase()) ?? []), d.token]);
  }
  const groups: { tokens: string[]; payload: { title: string; body: string; link: string; collapseId: string } }[] = [];
  let skipped = 0;
  for (const [nickLower, tokens] of byNick) {
    const nick = devices.find((d) => d.nickname?.toLowerCase() === nickLower)?.nickname ?? nickLower;
    try {
      const ouid = await getOuid(nick);
      const ids = await getUserMatches(ouid, 50, 30); // 앱 전적과 같은 30경기 — 숫자가 어긋나지 않게
      const details = await getMatchDetailsBatch(ids);
      const summaries = details.map((d) => summarizeMatch(d, ouid)).filter((m): m is MatchSummary => m !== null);
      const w = weeklyRecap(summaries);
      if (w.games < 3) { skipped++; continue; }
      const streak = w.bestStreak >= 2 ? ` · 최다 ${w.bestStreak}연승` : '';
      groups.push({
        tokens,
        payload: {
          title: `📅 이번 주 성적표 — ${w.win}승 ${w.draw}무 ${w.lose}패`,
          body: `승률 ${w.winRate}%${streak}. 주간 카드로 자랑해 보세요.`, // avgScore 는 앱 스코어와 척도가 달라 싣지 않는다
          link: `https://www.fcscope.xyz/user/${encodeURIComponent(nick)}`,
          collapseId: 'weekly',
        },
      });
    } catch {
      skipped++;
    }
  }
  const r = await dispatch(groups);
  return NextResponse.json({ nicknames: byNick.size, skipped, ...r });
}
