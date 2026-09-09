import { NextResponse } from 'next/server';
import { getAllPlayerReps } from '@/lib/nexon/players';
import { seasonIdOf } from '@/lib/nexon/players';

// ⚠️ force-dynamic 을 함께 쓰면 revalidate 가 무시되어 매 요청 6.5MB 인덱스를 재빌드한다.
// 앱은 주 1회만 호출하지만, 오리진 계산은 하루 1회로 충분하다.
export const revalidate = 86400;

/**
 * GET /api/v1/player-index — 앱 번들 선수 인덱스의 온라인 갱신본.
 *
 * 앱은 빌드 시점 스냅샷(iOS 저장소 scripts/build-player-index.mjs)을 내장하고,
 * 신규 시즌 카드를 반영하려고 주 1회만 이 엔드포인트를 확인한다.
 * 포맷은 스크립트 출력과 동일: { v, date, seasons, players: [[pid, name, [seasonId...]]] }
 *
 * 엣지 캐시 1일 — 사용자 수와 무관하게 오리진 계산은 하루 1회.
 */
export async function GET() {
  const reps = await getAllPlayerReps();
  if (reps.length === 0) {
    return NextResponse.json({ error: 'index unavailable' }, { status: 503 });
  }
  const seasons: Record<number, string> = {};
  const players: [number, string, number[]][] = [];
  for (const r of reps) {
    const ids: number[] = [];
    for (const v of r.seasons) {
      const sid = seasonIdOf(v.spid);
      ids.push(sid);
      if (v.season) seasons[sid] = v.season;
    }
    players.push([r.pid, r.name, ids]);
  }
  return NextResponse.json(
    { v: 1, date: new Date().toISOString().slice(0, 10), seasons, players },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
  );
}
