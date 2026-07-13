import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin-auth';
import { getOuid, getUserMatches } from '@/lib/nexon/api';
import { getMatchDetailsBatch } from '@/lib/nexon/cached';
import { getRankerStatsCached, rankerKey } from '@/lib/nexon/ranker';
import { isUserNotFound } from '@/lib/nexon/client';
import type { MatchDetail } from '@/lib/nexon/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 닉네임당 최대 ~34회 순차 넥슨 호출

const MAX_NICKNAMES = 5; // 함수 시간 안전 상한 — 더 필요하면 여러 번 실행
const MATCH_TYPE = 50;
const MATCH_COUNT = 30;
const TOP_COMBOS = 60;

/**
 * 픽 랭킹 원클릭 시딩 (관리자 전용).
 * "사이트에서 닉네임 검색"이 하던 일을 서버가 대신한다:
 * 닉네임 → 경기 목록 → 상세(match_cache 축적) → 방금 본 조합으로 랭커 스탯 워밍까지 한 번에.
 * 실행 후 /meta 는 최대 1시간(캐시) 내 반영.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email))
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  let nicknames: string[] = [];
  try {
    const body = await request.json();
    nicknames = Array.isArray(body?.nicknames)
      ? body.nicknames.map((n: unknown) => String(n).trim()).filter(Boolean)
      : [];
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  nicknames = [...new Set(nicknames)].slice(0, MAX_NICKNAMES);
  if (nicknames.length === 0)
    return NextResponse.json({ error: '닉네임을 입력하세요.' }, { status: 400 });

  const results: { nickname: string; ok: boolean; matches: number; note?: string }[] = [];
  const allDetails: MatchDetail[] = [];

  for (const nickname of nicknames) {
    try {
      const ouid = await getOuid(nickname);
      const ids = await getUserMatches(ouid, MATCH_TYPE, MATCH_COUNT);
      const details = await getMatchDetailsBatch(ids);
      allDetails.push(...details);
      results.push({ nickname, ok: true, matches: details.length });
    } catch (err) {
      results.push({
        nickname,
        ok: false,
        matches: 0,
        note: isUserNotFound(err) ? '구단주 없음' : '조회 실패',
      });
    }
  }

  // 방금 수집한 경기에서 선수×포지션 사용 빈도 → 상위 조합 랭커 워밍 (크론과 동일 로직)
  const freq = new Map<string, { id: number; po: number; n: number }>();
  for (const d of allDetails) {
    for (const e of d.matchInfo ?? []) {
      for (const p of e.player ?? []) {
        if ((p.status?.spRating ?? 0) <= 0 || p.spPosition === 28) continue;
        const key = rankerKey(p.spId, p.spPosition);
        const cur = freq.get(key);
        if (cur) cur.n += 1;
        else freq.set(key, { id: p.spId, po: p.spPosition, n: 1 });
      }
    }
  }
  const top = [...freq.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, TOP_COMBOS)
    .map((p) => ({ id: p.id, po: p.po }));

  let warmed = 0;
  if (top.length > 0) {
    try {
      const map = await getRankerStatsCached(MATCH_TYPE, top);
      warmed = map.size;
    } catch {
      // 워밍 실패해도 match_cache는 쌓였으므로 다음 크론이 처리
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    combos: top.length,
    warmed,
    hint:
      warmed > 0
        ? '/meta 반영은 최대 1시간(캐시) 소요. 변동 배지(▲▼)는 내일 크론 이후부터.'
        : '경기 수집은 됐지만 랭커 워밍이 비었어요. 잠시 후 다시 실행해 보세요.',
  });
}
