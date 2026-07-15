import { NextResponse } from 'next/server';
import { getRankerStatsCached, rankerKey } from '@/lib/nexon/ranker';
import { limitNexonFanout } from '@/lib/security/rate-limit';
import type { RankerStat } from '@/lib/nexon/types';

export const dynamic = 'force-dynamic';

/**
 * 슬롯 포지션 라벨 → spposition 코드 후보.
 * 넥슨 ranker-stats는 세부 코드(RCB=4/CB=5/LCB=6 등)로 쪼개져 있어,
 * 빌더의 라벨 하나에 중앙/좌우 변형을 함께 조회한 뒤 표본(matchCount) 큰 쪽을 쓴다.
 */
const POSITION_CANDIDATES: Record<string, number[]> = {
  GK: [0],
  RB: [3, 2],
  RWB: [2, 3],
  LB: [7, 8],
  LWB: [8, 7],
  CB: [5, 4, 6],
  CDM: [10, 9, 11],
  CM: [14, 13, 15],
  RM: [12],
  LM: [16],
  CAM: [18, 17, 19],
  RAM: [17, 18],
  LAM: [19, 18],
  CF: [21, 20, 22],
  ST: [25, 24, 26],
  RW: [23],
  LW: [27],
};

const MATCH_TYPE = 50; // 공식경기

export async function GET(request: Request) {
  // 캐시 미스 시 넥슨 ranker-stats 호출 유발 — IP rate limit
  const rl = limitNexonFanout(request.headers, 'ranker-stat');
  if (!rl.ok)
    return NextResponse.json(
      { error: '잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );

  const { searchParams } = new URL(request.url);
  const spid = Number(searchParams.get('spid'));
  const pos = (searchParams.get('pos') ?? '').toUpperCase();

  const candidates = POSITION_CANDIDATES[pos];
  if (!Number.isInteger(spid) || spid <= 0 || !candidates)
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  try {
    const map = await getRankerStatsCached(
      MATCH_TYPE,
      candidates.map((po) => ({ id: spid, po }))
    );

    // 표본이 가장 큰 포지션 변형 채택
    let best: RankerStat | null = null;
    for (const po of candidates) {
      const stat = map.get(rankerKey(spid, po));
      if (!stat) continue;
      if (!best || (stat.status.matchCount ?? 0) > (best.status.matchCount ?? 0))
        best = stat;
    }

    if (!best) return NextResponse.json({ found: false });

    const s = best.status;
    return NextResponse.json({
      found: true,
      spPosition: best.spPosition,
      stat: {
        matchCount: s.matchCount ?? 0,
        spRating: s.spRating ?? 0,
        goal: s.goal ?? 0,
        assist: s.assist ?? 0,
        shoot: s.shoot ?? 0,
        effectiveShoot: s.effectiveShoot ?? 0,
        passTry: s.passTry ?? 0,
        passSuccess: s.passSuccess ?? 0,
        dribbleTry: s.dribbleTry ?? 0,
        dribbleSuccess: s.dribbleSuccess ?? 0,
        tackle: s.tackle ?? 0,
        intercept: s.intercept ?? 0,
        block: s.block ?? 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: '랭커 스탯을 불러오지 못했어요.' },
      { status: 502 }
    );
  }
}
