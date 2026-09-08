import type { MatchDetail, MatchInfoEntry, MatchPlayer, ShootDetail } from './types';

/**
 * match_cache payload 패킹 — JSON 키 이름을 제거해 저장·WAL 을 줄인다.
 *
 * 실측(2026-09-04, 실제 매치 1건):
 *   원본 19,559B → slim 10,950B → **패킹 2,862B**
 *   slim 의 74%(8,088B)가 키 이름이었다. 한 경기에 선수 36명 × 14개 키가 반복되기 때문.
 *
 * 왜 중요한가: 콜드 조회 1회가 30행을 쓴다. 행당 10.9KB → 2.9KB 면 WAL 도 같은 비율로 줄어든다.
 * 과거 두 차례 장애가 모두 이 쓰기 증폭에서 시작했다(WAL 디스크 천장, Disk IO 소진).
 *
 * 설계:
 * - 고정 순서 배열. 첫 원소는 포맷 버전이라 나중에 필드를 늘려도 구분할 수 있다.
 * - `unpackMatchDetail` 은 **구 저장분(객체 jsonb)도 그대로 읽는다** → 마이그레이션 불필요.
 * - 순수 함수. 왕복(pack→unpack) 동일성을 실제 매치 데이터로 단위 테스트한다.
 */

export const PACK_VERSION = 1;

/** 배열 위치를 사람이 읽을 수 있게 남겨둔다 — 순서를 바꾸면 구 데이터가 깨진다. 추가는 뒤에만. */
const MD_KEYS = ['matchResult','matchEndType','possession','averageRating','dribble','foul','yellowCards','cornerKick','offsideCount','controller'] as const;
const SHOOT_KEYS = ['shootTotal','effectiveShootTotal','goalTotal','goalTotalDisplay','shootHeading','goalHeading','shootFreekick','goalFreekick','shootInPenalty','goalInPenalty','shootOutPenalty','goalOutPenalty','shootPenaltyKick','goalPenaltyKick'] as const;
const SHOT_KEYS = ['goalTime','x','y','result','spId','hitPost','inPenalty'] as const;
const PASS_KEYS = ['passTry','passSuccess','shortPassSuccess','longPassTry','throughPassTry','throughPassSuccess','lobbedThroughPassTry'] as const;
const DEF_KEYS = ['tackleTry','tackleSuccess','blockTry'] as const;
const STATUS_KEYS = ['spRating','goal','assist','shoot','effectiveShoot','passTry','passSuccess','dribbleTry','dribbleSuccess','tackleTry','tackle','intercept'] as const;

type Rec = Record<string, unknown>;

function packBy(keys: readonly string[], o: Rec | null | undefined): unknown[] | null {
  if (!o) return null;
  return keys.map((k) => o[k] ?? null);
}
function unpackBy(keys: readonly string[], a: unknown): Rec | undefined {
  if (!Array.isArray(a)) return undefined;
  const out: Rec = {};
  keys.forEach((k, i) => {
    if (a[i] !== null && a[i] !== undefined) out[k] = a[i];
  });
  return out;
}

/** slim 된 MatchDetail → 배열 형태 */
export function packMatchDetail(d: MatchDetail): unknown[] {
  return [
    PACK_VERSION,
    d.matchId,
    d.matchDate,
    d.matchType,
    (d.matchInfo ?? []).map((e) => [
      e.ouid,
      e.nickname,
      packBy(MD_KEYS, e.matchDetail as unknown as Rec),
      packBy(SHOOT_KEYS, e.shoot as unknown as Rec),
      (e.shootDetail ?? []).map((s) => packBy(SHOT_KEYS, s as unknown as Rec)),
      packBy(PASS_KEYS, e.pass as unknown as Rec),
      packBy(DEF_KEYS, e.defence as unknown as Rec),
      (e.player ?? []).map((p) => [p.spId, p.spPosition, packBy(STATUS_KEYS, p.status as unknown as Rec)]),
    ]),
  ];
}

/** 저장된 payload → MatchDetail. 배열이면 패킹본, 객체면 구 저장분(그대로 반환). */
export function unpackMatchDetail(payload: unknown): MatchDetail | null {
  if (!payload) return null;
  // 구 저장분(객체 jsonb) 호환 — 마이그레이션 없이 계속 읽힌다
  if (!Array.isArray(payload)) return payload as MatchDetail;

  const [, matchId, matchDate, matchType, sides] = payload as [
    number, string, string, number, unknown[]
  ];
  const matchInfo: MatchInfoEntry[] = (Array.isArray(sides) ? sides : []).map((raw) => {
    const [ouid, nickname, md, shoot, shots, pass, def, players] = raw as unknown[];
    return {
      ouid: ouid as string,
      nickname: nickname as string,
      matchDetail: unpackBy(MD_KEYS, md) as unknown as MatchInfoEntry['matchDetail'],
      shoot: unpackBy(SHOOT_KEYS, shoot) as unknown as MatchInfoEntry['shoot'],
      shootDetail: (Array.isArray(shots) ? shots : []).map(
        (s) => unpackBy(SHOT_KEYS, s) as unknown as ShootDetail
      ),
      pass: unpackBy(PASS_KEYS, pass) as unknown as MatchInfoEntry['pass'],
      defence: unpackBy(DEF_KEYS, def) as unknown as MatchInfoEntry['defence'],
      player: (Array.isArray(players) ? players : []).map((p) => {
        const [spId, spPosition, status] = p as unknown[];
        return {
          spId: spId as number,
          spPosition: spPosition as number,
          status: unpackBy(STATUS_KEYS, status) as unknown as MatchPlayer['status'],
        };
      }),
    };
  });

  return { matchId, matchDate, matchType, matchInfo };
}
