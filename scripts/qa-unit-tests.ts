/**
 * FC Scope 순수 로직 단위 테스트 (넥슨/DB 비의존).
 * 실행: npm test  (node --require ./scripts/qa-shim.cjs --import tsx scripts/qa-unit-tests.ts)
 * server-only 가드는 qa-shim.cjs가 빈 모듈로 치환한다.
 */
process.env.IP_HASH_SALT = process.env.IP_HASH_SALT ?? 'qa-salt-1234567890abcdef';

import type { MatchDetail } from '../lib/nexon/types';
import { pickKeyPlayers, topSeason } from '../lib/squad/card-badges';
import { getFormation, formationsByLine } from '../lib/squad/formations';
import { aggregateReport, reportInsights, computeWeekly } from '../lib/nexon/report';
import { summarizeMatch, aggregate, topRivals, pickNemesis } from '../lib/nexon/summary';
import type { Rival } from '../lib/nexon/summary';
import { verdictFromRating, verdictFromMatch } from '../lib/verdict';
import { rateLimit, clientIp } from '../lib/security/rate-limit';
import { hashIp, clientIpFrom } from '../lib/security/ip-hash';
import { getPositionLabel } from '../lib/nexon/meta';
import { baseLabelOfCode, assignByPosition, bestFormationId } from '../lib/squad/assign';
import { MATCH_RULES, computeMatchPerfStats, diagnoseMatchPerf } from '../lib/match/diagnosis';
import { topPickIdsByLine, isTopPick } from '../lib/meta/picks';
import { matchScore, recentScore, scoreTier } from '../lib/nexon/score';
import { parseFeed } from '../lib/youtube/feed';
import { playstyleOf } from '../lib/nexon/playstyle';
import { risingStreak, isPeak, sparklinePoints } from '../lib/form-trend';
import { isInAppBrowser, inAppBrowserName } from '../lib/client/in-app-browser';
import { streakLabel, hasStreakHighlight } from '../lib/nexon/streak-card';
import { weeklyRecap } from '../lib/nexon/weekly';
import type { MatchSummary } from '../lib/nexon/summary';
import { getPreset, presetsByLeague } from '../lib/squad/presets';
import { aggregatePlaystyle, analyzePlaystyle } from '../lib/playstyle';
import { slimMatchDetail } from '../lib/nexon/slim';
import { packMatchDetail, unpackMatchDetail } from '../lib/nexon/pack';
import { Semaphore } from '../lib/nexon/semaphore';
import { checkShape, checkRoute, ROUTES, SHAPES } from '../lib/api/contract';
import { sanitizeEvents, MAX_EVENTS } from '../lib/analytics/events';
import { readFileSync } from 'node:fs';
import { aggregatePlayers } from '../lib/nexon/player-stats';
import { squadCardTree } from '../lib/card/squad-card';
import { POST_TYPES, isPostType } from '../lib/community/post-types';
import type { Squad } from '../lib/squad/store';
import { isOuidLookupNotFound, MATCH_ID_RE } from '../lib/nexon/errors';
import { containsBannedWords, findBannedTerm } from '../lib/community/moderation';
import { APNS_PRODUCTION, APNS_SANDBOX, apnsHost, deadTokenDecision, isDeadToken } from '../lib/push/policy';
import { cleanDeviceText, sanitizeFavorites } from '../lib/push/device-input';

let pass = 0;
const fails: string[] = [];
function ok(cond: boolean, msg: string) {
  if (cond) pass++;
  else fails.push(msg);
}
function eq(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
function section(name: string) {
  // 구분용 (출력 최소화)
  void name;
}

// tsx 가 CJS 로 트랜스파일해 top-level await 를 쓸 수 없다.
// 비동기 테스트는 여기에 등록하고 파일 끝에서 한 번에 실행한다.
const asyncTests: { name: string; run: () => Promise<void> }[] = [];

// ── 헬퍼: 목 match-detail ─────────────────────────────────────
function mkMatch(
  id: string,
  myGoals: number,
  oppGoals: number,
  opts: { myTimes?: number[]; oppTimes?: number[]; rating?: number; heading?: [number, number]; outbox?: [number, number]; endType?: number } = {}
): MatchDetail {
  const shoot = (goals: number, extra: Record<string, number> = {}) => ({
    shootTotal: goals + 3, effectiveShootTotal: goals, goalTotal: goals, goalTotalDisplay: goals, ownGoal: 0,
    shootHeading: 2, goalHeading: 0, shootFreekick: 1, goalFreekick: 0,
    shootInPenalty: goals + 2, goalInPenalty: goals, shootOutPenalty: 3, goalOutPenalty: 0,
    shootPenaltyKick: 0, goalPenaltyKick: 0, ...extra,
  });
  const sd = (ts: number[]) => ts.map((t) => ({ goalTime: t, x: 0.8, y: 0.5, type: 1, result: 3, spId: 1, spGrade: 1, spLevel: 1, hitPost: false, inPenalty: true }));
  const myExtra: Record<string, number> = {};
  if (opts.heading) { myExtra.shootHeading = opts.heading[0]; myExtra.goalHeading = opts.heading[1]; }
  if (opts.outbox) { myExtra.shootOutPenalty = opts.outbox[0]; myExtra.goalOutPenalty = opts.outbox[1]; }
  return {
    matchId: id, matchDate: '2026-01-01T00:00:00', matchType: 50,
    matchInfo: [
      { ouid: 'ME', nickname: 'me', matchDetail: { matchResult: myGoals > oppGoals ? '승' : myGoals < oppGoals ? '패' : '무', matchEndType: opts.endType ?? 0, possession: 55, averageRating: opts.rating ?? 7.0 } as never, shoot: shoot(myGoals, myExtra) as never, shootDetail: sd(opts.myTimes ?? []) as never, pass: {} as never, defence: {} as never, player: [] },
      { ouid: 'OPP', nickname: 'opp', matchDetail: { matchResult: '?', matchEndType: 0, possession: 45, averageRating: 6.5 } as never, shoot: shoot(oppGoals) as never, shootDetail: sd(opts.oppTimes ?? []) as never, pass: {} as never, defence: {} as never, player: [] },
    ],
  } as MatchDetail;
}

// ── card-badges (스쿼드 카드 버그 회귀) ───────────────────────
section('card-badges');
const squad433: Squad = {
  id: 'x', name: '보엠 스쿼드', formation: '433', teamTag: null,
  slots: [
    // 일부러 GK를 배열 맨 앞에 (버그 재현: 이전엔 이게 '핵심'으로 뽑혔음)
    { slotId: 'gk1', spid: 25000001, name: '그레고르 코벨', season: 'PTG' },
    { slotId: 'cb1', spid: 25000002, name: 'N. 슐로터베크', season: '24' },
    { slotId: 'st1', spid: 25000003, name: '엘링 홀란', season: 'CU' },
    { slotId: 'lw1', spid: 25000004, name: '카림 아데예미', season: '25' },
    { slotId: 'rw1', spid: 25000005, name: '세루 기라시', season: '26TY' },
  ],
};
const keyPlayers = pickKeyPlayers(squad433, 2);
ok(!keyPlayers.includes('그레고르 코벨'), '핵심 선수에 골키퍼가 뽑히면 안 됨 (버그)');
ok(keyPlayers.every((n) => ['엘링 홀란', '카림 아데예미', '세루 기라시'].includes(n)), `핵심은 공격 포지션이어야 함 — got ${JSON.stringify(keyPlayers)}`);
eq(keyPlayers.length, 2, '핵심 선수 2명');
// 자유 배치 좌표(y) 우선: 코벨을 y=5(최전방)로 옮기면 뽑혀야 함
const moved: Squad = { ...squad433, slots: squad433.slots.map((s) => (s.slotId === 'gk1' ? { ...s, y: 5 } : s)) };
ok(pickKeyPlayers(moved, 1)[0] === '그레고르 코벨', '자유 배치 y 좌표가 포메이션 기본보다 우선해야 함');
// topSeason
const ts = topSeason(squad433, new Map());
ok(ts !== null && ts.count === 1, 'topSeason 최다 카운트');
const tsFallback = topSeason({ ...squad433, slots: [{ slotId: 'a', spid: 26000001, name: 'x' }] }, new Map([[26000001, '26TOTY']]));
eq(tsFallback, { season: '26TOTY', count: 1 }, 'topSeason은 seasonNames 폴백을 사용');

// squadCardTree: 포메이션 피치 카드 트리 — 폰트 서브셋에 스쿼드명·포메이션명·선수명 포함
const cardTree = squadCardTree(squad433, new Map(), true);
ok(cardTree.element != null, '스쿼드 카드 트리 생성');
ok(cardTree.fontText.includes('보엠 스쿼드'), '카드 폰트텍스트에 스쿼드명 포함');
ok(cardTree.fontText.includes('4-3-3'), '카드 폰트텍스트에 포메이션명 포함');
ok(cardTree.fontText.includes('홀란') || cardTree.fontText.includes('엘링'), '카드 폰트텍스트에 선수명 포함');

// post-types: 스쿼드 배틀 유형
ok(isPostType('squad_battle'), 'squad_battle는 유효한 유형');
ok(!isPostType('nope'), '알 수 없는 유형 거부');
ok(
  POST_TYPES.squad_battle.fields.includes('squad') &&
    POST_TYPES.squad_battle.fields.includes('squad_b'),
  'squad_battle은 A·B 스쿼드 필드를 가짐'
);

// ── formations ───────────────────────────────────────────────
section('formations');
const f433 = getFormation('433');
eq(f433.slots.length, 11, '433은 11슬롯');
const gk = f433.slots.find((s) => s.pos === 'GK');
ok(!!gk && gk.y >= 80, 'GK는 하단(큰 y)');
const fwdMinY = Math.min(...f433.slots.filter((s) => s.pos !== 'GK').map((s) => s.y));
ok(fwdMinY < 40, '공격수는 상단(작은 y)');
eq(getFormation('nonexistent-xyz').id, getFormation('433').id, '알 수 없는 포메이션은 기본값 폴백');
ok(formationsByLine().length >= 2, '라인별 포메이션 그룹 존재');

// ── report ───────────────────────────────────────────────────
section('report');
const rptDetails = [
  mkMatch('1', 1, 3, { myTimes: [300], oppTimes: [600, 4800, 5000] }),
  mkMatch('2', 0, 2, { oppTimes: [4700, 5100] }),
  mkMatch('3', 2, 4, { myTimes: [1000, 2000], oppTimes: [4600, 4900, 5200, 300] }),
];
const rpt = aggregateReport(rptDetails, 'ME');
eq(rpt.played, 3, 'report played=3');
eq(rpt.goalsFor, 3, 'report goalsFor');
eq(rpt.goalsAgainst, 9, 'report goalsAgainst');
eq(rpt.timeBands[5].againstGoals, 7, '76-90+ 밴드 실점 집계');
eq(rpt.timeBands[0].forGoals, 1, '0-15 밴드 득점 집계');
ok(rpt.form.length === 3 && rpt.form.every((g) => g.result === '패'), 'form 3연패');
const ins = reportInsights(rpt);
ok(ins.some((i) => i.tone === 'warn' && i.text.includes('후반 막판')), '후반막판 실점 인사이트');
ok(ins.some((i) => i.text.includes('연패')), '연패 인사이트');
// 임계 미달이면 인사이트 없음(빈 조언 금지)
const calm = aggregateReport([mkMatch('a', 2, 1, { myTimes: [1000, 1200], oppTimes: [900] })], 'ME');
ok(reportInsights(calm).every((i) => !i.text.includes('후반 막판')), '실점 적으면 후반막판 경고 없음');
// 잘못된 데이터 방어: matchInfo 없는 항목 스킵
const rptBad = aggregateReport([{ matchId: 'z', matchDate: '', matchType: 50, matchInfo: [] } as MatchDetail, ...rptDetails], 'ME');
eq(rptBad.played, 3, '빈 matchInfo는 집계에서 제외');

// computeWeekly: 최근 7일 vs 직전 7일 (기준=최신 경기 시각)
const DAY = 86400_000;
const base = 1_700_000_000_000; // 고정 기준(재현성)
const weekly = computeWeekly([
  { time: base, result: '승' },
  { time: base - 2 * DAY, result: '승' },
  { time: base - 3 * DAY, result: '패' }, // recent: 2승1패 → 67%
  { time: base - 9 * DAY, result: '패' },
  { time: base - 10 * DAY, result: '패' }, // prev: 0승2패 → 0%
]);
ok(weekly !== null, 'computeWeekly 결과 존재');
eq(weekly!.recentGames, 3, 'weekly 최근 7일 경기수');
eq(weekly!.recentWinRate, 67, 'weekly 최근 승률');
eq(weekly!.prevWinRate, 0, 'weekly 직전주 승률');
eq(weekly!.deltaWinRate, 67, 'weekly 승률 변화(+67%p)');
eq(computeWeekly([]), null, 'weekly 빈 입력 null');
ok(computeWeekly([{ time: base, result: '승' }])!.prevWinRate === null, 'weekly 직전주 없으면 null');

// ── summary ──────────────────────────────────────────────────
section('summary');
const sm = summarizeMatch(mkMatch('s', 3, 1, { rating: 7.4 }), 'ME');
ok(sm !== null && sm.result === '승', 'summarizeMatch 승 판정');
eq(sm!.me.goals, 3, 'summarizeMatch 내 골');
eq(sm!.opponent?.goals, 1, 'summarizeMatch 상대 골');
const smForfeit = summarizeMatch(mkMatch('f', 0, 0, { endType: 1 }), 'ME');
ok(smForfeit!.forfeit === true, '몰수경기 플래그');
const agg = aggregate([sm!, summarizeMatch(mkMatch('s2', 0, 2), 'ME')!]);
eq(agg.win, 1, 'aggregate 승수');
eq(agg.lose, 1, 'aggregate 패수');
eq(agg.winRate, 50, 'aggregate 승률');
eq(aggregate([]).winRate, 0, '빈 집계 승률 0(0나눗셈 방어)');

// topRivals: 2회 이상 만난 상대만, H2H 집계
const rivalMatches = [
  summarizeMatch(mkMatch('r1', 3, 1), 'ME')!, // vs opp 승
  summarizeMatch(mkMatch('r2', 0, 2), 'ME')!, // vs opp 패
  summarizeMatch(mkMatch('r3', 1, 1), 'ME')!, // vs opp 무
];
const rivals = topRivals(rivalMatches);
eq(rivals.length, 1, 'topRivals: opp 1명(3회 만남)');
eq([rivals[0].win, rivals[0].draw, rivals[0].lose], [1, 1, 1], 'topRivals H2H 승무패');
eq(topRivals([summarizeMatch(mkMatch('r4', 1, 0), 'ME')!]).length, 0, 'topRivals: 1회만 만난 상대는 제외');

// ── verdict ──────────────────────────────────────────────────
section('verdict');
eq(verdictFromRating({ rating: 8.1, subjectType: 'self' }).tier, 'GOAT', '8.1→GOAT');
eq(verdictFromRating({ rating: 7.3, subjectType: 'self' }).tier, 'WORLDCLASS', '7.3→WORLDCLASS');
eq(verdictFromRating({ rating: 6.8, subjectType: 'self' }).tier, 'SOLID', '6.8→SOLID');
eq(verdictFromRating({ rating: 5.0, subjectType: 'self' }).tier, 'LIABILITY', '5.0→LIABILITY');
// otherUser는 roast 금지 — 낮은 평점이라도 roast 문구가 나오면 안 됨
const other = verdictFromRating({ rating: 5.0, subjectType: 'otherUser' });
ok(other.oneLiner !== '이번 판 구멍이었다', 'otherUser는 roast 문구 금지');
const vm = verdictFromMatch({ result: '승', myRating: 7.5 });
eq([vm.color, vm.icon], ['lime', '▲'], '승 → lime ▲');
eq([verdictFromMatch({ result: '패', myRating: 6 }).color, verdictFromMatch({ result: '패', myRating: 6 }).icon], ['lose', '▼'], '패 → lose ▼');
eq(verdictFromMatch({ result: '무', myRating: 6 }).color, 'muted', '무 → muted');
ok(verdictFromRating({ rating: 100, subjectType: 'self' }).score === 100, 'score 상한 클램프');

// ── rate-limit ───────────────────────────────────────────────
section('rate-limit');
const k = 'test:1.1.1.1';
eq(rateLimit(k, 2, 10000).ok, true, 'rate 1회차 허용');
eq(rateLimit(k, 2, 10000).ok, true, 'rate 2회차 허용');
const blocked = rateLimit(k, 2, 10000);
eq(blocked.ok, false, 'rate 3회차 차단');
ok(blocked.retryAfter > 0, '차단 시 retryAfter > 0');
eq(clientIp(new Headers({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })), '9.9.9.9', 'clientIp는 x-real-ip 우선');
eq(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })), '1.2.3.4', 'clientIp xff 첫 항목');
eq(clientIp(new Headers()), 'unknown', 'clientIp 폴백 unknown');

// ── ip-hash ──────────────────────────────────────────────────
section('ip-hash');
const h1 = hashIp('203.0.113.5');
const h2 = hashIp('203.0.113.5');
eq(h1, h2, 'hashIp 결정적');
ok(h1 !== null && h1 !== '203.0.113.5', 'hashIp는 평문 IP를 반환하지 않음');
ok(hashIp('203.0.113.6') !== h1, '다른 IP는 다른 해시');
eq(hashIp(''), null, '빈 IP는 null');
eq(clientIpFrom(new Headers({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2' })), '10.0.0.1', 'clientIpFrom xff 첫 항목');
eq(
  clientIpFrom(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' })),
  '1.2.3.4',
  'clientIpFrom x-real-ip 우선 (XFF 위조 방지)'
);

// ── meta / assign / presets ──────────────────────────────────
section('meta/assign/presets');
eq(getPositionLabel(0), 'GK', 'position 0 = GK');
eq(getPositionLabel(25), 'ST', 'position 25 = ST');
ok(getPositionLabel(999).length > 0, '알 수 없는 포지션도 문자열 반환');
eq(baseLabelOfCode(0), 'GK', 'baseLabelOfCode 0 = GK');
ok(baseLabelOfCode(99999).length > 0, 'baseLabelOfCode 폴백');
const assigned = assignByPosition(getFormation('433').slots, [
  { pos: 'ST', name: 'striker', spid: 1 },
  { pos: 'GK', name: 'keeper', spid: 2 },
]);
ok(Object.keys(assigned).length === 2, 'assignByPosition 2명 배치');
ok(presetsByLeague().length >= 1, '프리셋 리그 그룹 존재');
ok(getPreset('___none___') === undefined, '없는 프리셋은 undefined');

// ── playstyle 스모크 ─────────────────────────────────────────
section('playstyle');
const psDetails = Array.from({ length: 8 }, (_, i) => mkMatch(`p${i}`, 2, 1, { myTimes: [1000, 2500], rating: 7.1 }));
const ps = analyzePlaystyle(aggregatePlaystyle(psDetails, 'ME'));
ok(typeof ps.confidence === 'string', 'playstyle confidence 반환');
ok(Array.isArray(ps.axes) && ps.axes.length > 0, 'playstyle 축 배열');
ok(analyzePlaystyle(aggregatePlaystyle([], 'ME')).confidence === 'hold', '경기 없으면 hold');

// ── bestFormationId (선발 라벨 → 포메이션) ───────────────────
section('bestFormationId');
eq(
  bestFormationId([0, 7, 5, 4, 3, 13, 14, 15, 27, 25, 23].map(baseLabelOfCode)),
  '433',
  '4-3-3 판별'
);
eq(
  bestFormationId([0, 7, 5, 4, 3, 9, 11, 19, 18, 17, 25].map(baseLabelOfCode)),
  '4231',
  '4-2-3-1 판별'
);
eq(
  bestFormationId([0, 4, 5, 6, 8, 13, 14, 15, 2, 24, 26].map(baseLabelOfCode)),
  '352',
  '3-5-2 판별'
);
ok(bestFormationId([]).length > 0, '빈 입력도 폴백 포메이션 반환');

// ── 공식경기 성향 진단 (사전 셋팅 룰) ────────────────────────
section('match-diagnosis');
ok(MATCH_RULES.length >= 100, `경기 진단 룰 100개 이상 (현재 ${MATCH_RULES.length}개)`);
eq(new Set(MATCH_RULES.map((r) => r.id)).size, MATCH_RULES.length, '경기 룰 id 중복 없음');
ok(MATCH_RULES.every((r) => r.title.length > 0 && r.desc.length > 0), '경기 룰 제목·설명 존재');

let sumSeq = 0;
const sum = (result: '승' | '무' | '패', gf: number, ga: number, rating = 7, poss = 50): MatchSummary =>
  ({
    matchId: `m-${sumSeq++}`,
    matchDate: '2026-07-15T00:00:00',
    matchType: 50,
    result,
    forfeit: false,
    me: { nickname: 'ME', goals: gf, possession: poss, rating },
    opponent: { nickname: 'OP', goals: ga },
  }) as MatchSummary;

// 10연승 고승률 → 폼 미쳤다
const hot = computeMatchPerfStats(Array.from({ length: 12 }, () => sum('승', 3, 0, 8)));
eq(diagnoseMatchPerf(hot).type?.id, 't-champ', '고승률 연승 유형 판정');
eq(hot.currentStreak, 12, '연승 계산');
eq(hot.cleanSheets, 12, '클린시트 계산');

// 저승률 → 리빌딩
const cold = computeMatchPerfStats([
  ...Array.from({ length: 3 }, () => sum('승', 1, 0)),
  ...Array.from({ length: 9 }, () => sum('패', 0, 2)),
]);
eq(diagnoseMatchPerf(cold).type?.id, 't-rebuilding', '저승률 유형 판정');

// 빈 표본 → 진단 없음, 1경기 → 폴백 유형
eq(diagnoseMatchPerf(computeMatchPerfStats([])).type, null, '경기 없으면 진단 없음');
ok(diagnoseMatchPerf(computeMatchPerfStats([sum('무', 1, 1)])).type !== null, '1경기도 유형 폴백');
ok(diagnoseMatchPerf(hot).notes.length >= 1 && diagnoseMatchPerf(hot).notes.length <= 4, '경기 코멘트 1~4개');

// 모든 경기 룰 예외 없이 평가
for (const st of [hot, cold, computeMatchPerfStats([])]) {
  let threw = false;
  try {
    for (const r of MATCH_RULES) r.when(st);
  } catch {
    threw = true;
  }
  ok(!threw, '경기 룰 평가 중 예외 없음');
}

// ── 내 픽 vs 랭커 픽 (spId×라인 대조, 포지션 코드 별칭 오탐 방지) ──
{
  const pr = (spId: number, position: number) => ({
    spId,
    position,
    matchCount: 100,
    goalsPerMatch: 1,
    passPct: 80,
  });
  // 랭커 TOP픽: 100번 카드가 ST 코드 25로 ATT 라인에 있음
  const byLine = new Map([['ATT', [pr(100, 25)]]]);
  const ids = topPickIdsByLine(byLine, 10);
  ok(ids.get('ATT')?.has(100) === true, 'topPickIdsByLine: 라인별 spId 집합');
  // 같은 선수(100)를 다른 ST 코드 24로 기용해도 같은 라인이라 대세픽으로 인정
  eq(isTopPick(ids, 100, 24), true, 'isTopPick: 포지션 코드 달라도 같은 라인이면 매칭');
  // 다른 선수/다른 라인은 미매칭
  eq(isTopPick(ids, 999, 25), false, 'isTopPick: 집합에 없는 spId는 미매칭');
  eq(isTopPick(ids, 100, 0), false, 'isTopPick: 다른 라인(GK)이면 미매칭');
  // topN 컷: 11번째 픽은 집합에서 제외
  const many = new Map([
    ['ATT', Array.from({ length: 12 }, (_, i) => pr(200 + i, 25))],
  ]);
  const top10 = topPickIdsByLine(many, 10);
  eq(top10.get('ATT')?.size, 10, 'topPickIdsByLine: topN=10 컷');
  eq(isTopPick(top10, 211, 25), false, 'isTopPick: TOP10 밖 카드는 미매칭');
}

// ── FC Scope 스코어 (경기 퍼포먼스 0~10) ──
{
  const big = matchScore(sum('승', 4, 0, 8)); // 대승+고평점
  ok(big >= 8, 'matchScore: 대승+고평점은 8점대↑');
  const bad = matchScore(sum('패', 0, 4, 5)); // 대패+저평점
  ok(bad < 5 && bad >= 0, 'matchScore: 대패+저평점은 5점 미만');
  const mid = matchScore(sum('무', 1, 1, 7)); // 무승부 평범
  ok(mid >= 5 && mid < 6, 'matchScore: 무승부 평범대');
  // 0~10 클램프
  const ext = matchScore(sum('승', 9, 0, 9, 90));
  ok(ext <= 10, 'matchScore: 상한 10 클램프');
  // 몰수는 고정값
  eq(matchScore({ ...sum('승', 3, 0), forfeit: true }), 6, 'matchScore: 몰수승 6 고정');
  eq(matchScore({ ...sum('패', 0, 3), forfeit: true }), 3, 'matchScore: 몰수패 3 고정');
  // recentScore
  eq(recentScore([]), 0, 'recentScore: 표본 없으면 0');
  ok(recentScore([sum('승', 3, 0, 8), sum('패', 0, 3, 5)]) > 0, 'recentScore: 혼합 표본 평균');
  // scoreTier 경계
  eq(scoreTier(8).tone, 'gold', 'scoreTier: 8↑ gold');
  eq(scoreTier(7).tone, 'win', 'scoreTier: 6.5↑ win');
  eq(scoreTier(5.5).tone, 'muted', 'scoreTier: 5↑ muted');
  eq(scoreTier(4).tone, 'lose', 'scoreTier: 5미만 lose');
}

// ── 유튜브 RSS 파서 ──
{
  const xml = `<?xml version="1.0"?><feed>
    <entry><yt:videoId>abc123XYZ_-</yt:videoId>
      <title>FC온라인 &amp; 스쿼드 &lt;신규&gt; 메타</title>
      <published>2026-07-20T10:00:00+00:00</published></entry>
    <entry><yt:videoId>def456</yt:videoId>
      <title>두 번째 영상</title>
      <published>2026-07-19T10:00:00+00:00</published></entry>
    <entry><yt:videoId>ghi789</yt:videoId>
      <title>세 번째(잘림)</title>
      <published>2026-07-18T10:00:00+00:00</published></entry>
  </feed>`;
  const ch = { name: "테스트채널", channelId: "UCtest" };
  const vids = parseFeed(xml, ch, 2);
  eq(vids.length, 2, 'parseFeed: perChannel=2 컷');
  eq(vids[0].id, 'abc123XYZ_-', 'parseFeed: videoId 추출');
  eq(vids[0].title, 'FC온라인 & 스쿼드 <신규> 메타', 'parseFeed: XML 엔티티 디코드');
  eq(vids[0].channel, '테스트채널', 'parseFeed: 채널명 주입');
  eq(vids[0].url, 'https://www.youtube.com/watch?v=abc123XYZ_-', 'parseFeed: watch URL');
  eq(vids[0].thumb, 'https://i.ytimg.com/vi/abc123XYZ_-/mqdefault.jpg', 'parseFeed: 썸네일 URL');
  eq(parseFeed('<feed></feed>', ch).length, 0, 'parseFeed: 빈 피드 → 0');
  eq(parseFeed('total garbage', ch).length, 0, 'parseFeed: 깨진 입력 → 0 (throw 없음)');
}

// ── 플레이스타일 배지 ──
{
  const base = { goal: 0, assist: 0, passTry: 0, passSuccess: 0, dribbleTry: 0, dribbleSuccess: 0, tackle: 0, block: 0 };
  eq(playstyleOf({ ...base, goal: 0.6 })?.label, '결정력형', 'playstyle: 득점 → 결정력형');
  eq(playstyleOf({ ...base, dribbleTry: 5, dribbleSuccess: 4 })?.label, '개인기형', 'playstyle: 드리블 성공률↑ → 개인기형');
  eq(playstyleOf({ ...base, passTry: 20, passSuccess: 18, assist: 0.3 })?.label, '연계형', 'playstyle: 패스+어시 → 연계형');
  eq(playstyleOf({ ...base, tackle: 2, block: 2 })?.label, '수비형', 'playstyle: 태클+블락 → 수비형');
  eq(playstyleOf(base), null, 'playstyle: 신호 약하면 null');
  // 우선순위: 득점이 다른 조건보다 우선
  eq(playstyleOf({ ...base, goal: 0.5, passTry: 20, passSuccess: 19, assist: 0.5 })?.label, '결정력형', 'playstyle: 득점 우선순위');
}

// ── match_cache slim payload projection ──
{
  // 모든 필드(사용/미사용)를 채운 리치 fixture — slim 후에도 소비자가 읽는 값이
  // 보존되고, 미사용 필드만 제거되는지 검증한다.
  const rich: MatchDetail = {
    matchId: 'slim1', matchDate: '2026-01-01T00:00:00', matchType: 50,
    matchInfo: [
      {
        ouid: 'ME', nickname: 'me',
        matchDetail: { seasonId: 1, matchResult: '승', matchEndType: 0, systemPause: 0, foul: 3, injury: 0, redCards: 0, yellowCards: 1, dribble: 12, cornerKick: 4, possession: 55, offsideCount: 2, averageRating: 7.4, controller: 'keyboard' },
        shoot: { shootTotal: 10, effectiveShootTotal: 6, goalTotal: 3, goalTotalDisplay: 3, ownGoal: 0, shootHeading: 2, goalHeading: 1, shootFreekick: 1, goalFreekick: 0, shootInPenalty: 7, goalInPenalty: 3, shootOutPenalty: 3, goalOutPenalty: 0, shootPenaltyKick: 0, goalPenaltyKick: 0 },
        shootDetail: [{ goalTime: 1200, x: 0.8, y: 0.5, type: 1, result: 3, spId: 101, spGrade: 5, spLevel: 30, spIdAssist: 102, assistX: 0.6, assistY: 0.4, hitPost: false, inPenalty: true }],
        pass: { passTry: 300, passSuccess: 270, shortPassTry: 200, shortPassSuccess: 190, longPassTry: 30, longPassSuccess: 20, throughPassTry: 10, throughPassSuccess: 7, lobbedThroughPassTry: 3, lobbedThroughPassSuccess: 2, bouncingLobPassTry: 1, bouncingLobPassSuccess: 1, drivenGroundPassTry: 5, drivenGroundPassSuccess: 4 },
        defence: { blockTry: 4, blockSuccess: 2, tackleTry: 15, tackleSuccess: 9 },
        player: [{ spId: 101, spPosition: 20, spGrade: 5, status: { goal: 2, assist: 1, shoot: 5, effectiveShoot: 3, passTry: 40, passSuccess: 36, dribbleTry: 8, dribbleSuccess: 6, ballPossesionTry: 50, ballPossesionSuccess: 45, aerialTry: 3, aerialSuccess: 2, blockTry: 1, block: 0, tackleTry: 2, tackle: 1, intercept: 3, defending: 4, yellowCards: 0, redCards: 0, spRating: 8.1 } }],
      } as never,
      { ouid: 'OPP', nickname: 'opp', matchDetail: { matchResult: '패', matchEndType: 0, foul: 5, yellowCards: 2, dribble: 8, cornerKick: 2, possession: 45, offsideCount: 1, averageRating: 6.5, controller: 'gamepad' }, shoot: { shootTotal: 6, effectiveShootTotal: 2, goalTotal: 1, goalTotalDisplay: 1, shootHeading: 0, goalHeading: 0, shootFreekick: 0, goalFreekick: 0, shootInPenalty: 4, goalInPenalty: 1, shootOutPenalty: 2, goalOutPenalty: 0, shootPenaltyKick: 0, goalPenaltyKick: 0 }, shootDetail: [{ goalTime: 800, x: 0.7, y: 0.5, result: 3, spId: 201, hitPost: false, inPenalty: true }], pass: { passTry: 250, passSuccess: 210, shortPassSuccess: 180, longPassTry: 25, throughPassTry: 8, throughPassSuccess: 5, lobbedThroughPassTry: 2 }, defence: { blockTry: 3, tackleTry: 12, tackleSuccess: 7 }, player: [{ spId: 201, spPosition: 20, status: { goal: 1, assist: 0, shoot: 3, effectiveShoot: 2, passTry: 30, passSuccess: 25, dribbleTry: 5, dribbleSuccess: 3, tackleTry: 1, tackle: 0, intercept: 1, spRating: 6.9 } }] } as never,
    ],
  } as MatchDetail;

  const slim = slimMatchDetail(rich);

  // 소비자가 읽는 값은 원본과 동일해야 함(집계 출력 비교 — 강한 보증)
  eq(summarizeMatch(slim, 'ME'), summarizeMatch(rich, 'ME'), 'slim: summarizeMatch 동일');
  eq(aggregateReport([slim], 'ME'), aggregateReport([rich], 'ME'), 'slim: aggregateReport 동일');
  eq(aggregatePlayers([slim], 'ME'), aggregatePlayers([rich], 'ME'), 'slim: aggregatePlayers 동일');
  eq(aggregatePlaystyle([slim], 'ME'), aggregatePlaystyle([rich], 'ME'), 'slim: aggregatePlaystyle 동일');

  const me = slim.matchInfo[0];
  // 유지되어야 하는 대표 필드
  eq(me.matchDetail.controller, 'keyboard', 'slim: matchDetail.controller 유지');
  eq(me.shoot.goalTotalDisplay, 3, 'slim: shoot.goalTotalDisplay 유지');
  eq(me.shootDetail[0].result, 3, 'slim: shootDetail.result 유지');
  eq(me.shootDetail.length, 1, 'slim: shootDetail 배열 전체 유지');
  eq(me.pass.throughPassSuccess, 7, 'slim: pass.throughPassSuccess 유지');
  eq(me.defence.blockTry, 4, 'slim: defence.blockTry 유지');
  eq(me.player[0].status.spRating, 8.1, 'slim: player.status.spRating 유지');
  eq(me.player.length, 1, 'slim: player 배열 유지');
  // 제거되어야 하는 미사용 필드
  ok(me.matchDetail.seasonId === undefined, 'slim: matchDetail.seasonId 제거');
  ok(me.shoot.ownGoal === undefined, 'slim: shoot.ownGoal 제거');
  ok(me.shootDetail[0].type === undefined, 'slim: shootDetail.type 제거');
  ok(me.shootDetail[0].spGrade === undefined, 'slim: shootDetail.spGrade 제거');
  ok(me.pass.shortPassTry === undefined, 'slim: pass.shortPassTry 제거');
  ok(me.defence.blockSuccess === undefined, 'slim: defence.blockSuccess 제거');
  ok(me.player[0].spGrade === undefined, 'slim: player.spGrade 제거');
  ok(me.player[0].status.block === undefined, 'slim: player.status.block 제거');
  ok(me.player[0].status.defending === undefined, 'slim: player.status.defending 제거');
}

// ── match_cache payload 패킹 (키 제거로 저장·WAL 절감) ───────
section('pack/unpack');
{
  // 실제 넥슨 match-detail 픽스처(익명화)로 왕복 검증 — 배열 순서가 어긋나면 즉시 실패
  const real = JSON.parse(
    readFileSync(new URL('./fixtures/match-detail.json', import.meta.url), 'utf8')
  ) as MatchDetail;
  const slimmed = slimMatchDetail(real);
  const packed = packMatchDetail(slimmed);
  const back = unpackMatchDetail(packed)!;

  eq(back, slimmed, '실데이터 왕복: pack → unpack 이 slim 과 완전 동일');
  ok(Array.isArray(packed), '패킹 결과는 배열(구 저장분과 구분 가능)');
  ok(
    JSON.stringify(packed).length < JSON.stringify(slimmed).length * 0.4,
    `패킹이 60% 이상 절감 (slim ${JSON.stringify(slimmed).length}B → packed ${JSON.stringify(packed).length}B)`
  );

  // 소비자 출력이 패킹 전후로 동일해야 한다
  const ouid = slimmed.matchInfo[0].ouid;
  eq(summarizeMatch(back, ouid), summarizeMatch(slimmed, ouid), '패킹 왕복: summarizeMatch 동일');
  eq(aggregateReport([back], ouid), aggregateReport([slimmed], ouid), '패킹 왕복: aggregateReport 동일');
  eq(aggregatePlayers([back], ouid), aggregatePlayers([slimmed], ouid), '패킹 왕복: aggregatePlayers 동일');
  eq(aggregatePlaystyle([back], ouid), aggregatePlaystyle([slimmed], ouid), '패킹 왕복: aggregatePlaystyle 동일');

  // 구 저장분(객체 jsonb) 하위호환 — 마이그레이션 없이 계속 읽혀야 한다
  eq(unpackMatchDetail(slimmed as unknown), slimmed, '구 저장분(객체)은 그대로 반환');
  eq(unpackMatchDetail(null), null, 'null 안전');
  eq(unpackMatchDetail(undefined), null, 'undefined 안전');

  // 빈 매치(참가자 0)도 깨지지 않아야 한다
  const empty: MatchDetail = { matchId: 'e', matchDate: '2026-01-01T00:00:00', matchType: 50, matchInfo: [] };
  eq(unpackMatchDetail(packMatchDetail(empty)), empty, '빈 matchInfo 왕복');
}

// ── 넥슨 호출 세마포어 (동시성 상한·429 강등) ───────────────
// 동시성 코드는 리뷰로 잡히지 않는다 — 상한 초과·데드락·강등 3가지를 실제로 돌려 확인한다.
asyncTests.push({
  name: 'semaphore',
  run: async () => {
    // ① 상한을 절대 넘지 않는다 + 전부 완료된다(데드락 없음)
    const sem = new Semaphore(3);
    let peak = 0;
    let done = 0;
    await Promise.all(
      Array.from({ length: 20 }, async () => {
        await sem.acquire();
        peak = Math.max(peak, sem.inFlight);
        await new Promise((r) => setTimeout(r, 1));
        sem.release();
        done++;
      })
    );
    eq(peak, 3, '세마포어: 동시 실행이 상한(3)을 넘지 않음');
    eq(done, 20, '세마포어: 20건 전부 완료 (데드락 없음)');
    eq(sem.inFlight, 0, '세마포어: 완료 후 in-flight 0');

    // ② 429 강등 — 진행 중에 상한이 1로 떨어져도 남은 작업이 전부 끝난다
    const sem2 = new Semaphore(3);
    let demoted = false;
    let done2 = 0;
    let peakAfter = 0;
    await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        await sem2.acquire();
        if (demoted) peakAfter = Math.max(peakAfter, sem2.inFlight);
        await new Promise((r) => setTimeout(r, 1));
        if (i === 2 && !demoted) {
          demoted = true;
          sem2.demote(); // 429 관측 시뮬레이션
        }
        sem2.release();
        done2++;
      })
    );
    eq(done2, 12, '세마포어: 강등 중에도 12건 전부 완료 (대기자 깨우기 정상)');
    eq(sem2.currentLimit, 1, '세마포어: 강등 후 상한 1');
    ok(peakAfter <= 3, `세마포어: 강등 후 동시 실행이 늘지 않음 (관측 ${peakAfter})`);
    eq(sem2.inFlight, 0, '세마포어: 강등 경로도 in-flight 0으로 수렴');

    // ③ 강등은 되돌아가지 않는다 (진동 방지)
    sem2.demote();
    eq(sem2.currentLimit, 1, '세마포어: 중복 강등 안전');

    // ④ 상한 1은 완전 순차와 동일 (구 동작 보존)
    const sem3 = new Semaphore(1);
    let peak3 = 0;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        await sem3.acquire();
        peak3 = Math.max(peak3, sem3.inFlight);
        await new Promise((r) => setTimeout(r, 1));
        sem3.release();
      })
    );
    eq(peak3, 1, '세마포어: 상한 1이면 완전 순차');
  },
});

// ── 폼 추세(form-trend) ──────────────────────────────────────
{
  // risingStreak: 마지막 값 기준 연속 상승
  eq(risingStreak([50, 55, 60]), 2, 'risingStreak: 2연속 상승');
  eq(risingStreak([60, 55]), 0, 'risingStreak: 하락이면 0');
  eq(risingStreak([50, 55, 55]), 0, 'risingStreak: 동률은 상승 아님');
  eq(risingStreak([40, 50, 45, 48, 52]), 2, 'risingStreak: 마지막 구간만 카운트');
  eq(risingStreak([70]), 0, 'risingStreak: 표본 1개면 0');
  eq(risingStreak([]), 0, 'risingStreak: 빈 배열 0');

  // isPeak: 마지막이 최고치(평평 제외)
  ok(isPeak([50, 55, 60]), 'isPeak: 마지막이 최고');
  ok(isPeak([60, 50, 60]), 'isPeak: 동률 최고 포함');
  ok(!isPeak([60, 55, 58]), 'isPeak: 최고 아니면 false');
  ok(!isPeak([55, 55, 55]), 'isPeak: 전부 동일(평평)은 false');
  ok(!isPeak([80]), 'isPeak: 표본 1개면 false');

  // sparklinePoints: 개수·범위·정규화
  const pts = sparklinePoints([0, 50, 100], 200, 40);
  eq(pts.split(' ').length, 3, 'sparklinePoints: 점 개수 = 값 개수');
  const xs = pts.split(' ').map((p) => Number(p.split(',')[0]));
  eq(xs[0], 0, 'sparklinePoints: 첫 x=0');
  eq(xs[2], 200, 'sparklinePoints: 마지막 x=w');
  const ys = pts.split(' ').map((p) => Number(p.split(',')[1]));
  ok(ys[2] < ys[0], 'sparklinePoints: 큰 값일수록 y 작음(위로)');
  eq(sparklinePoints([5], 200, 40), '', 'sparklinePoints: 표본<2면 빈 문자열');
  ok(
    sparklinePoints([50, 50, 50], 200, 40).split(' ').every((p) => {
      const y = Number(p.split(',')[1]);
      return Math.abs(y - 20) < 0.01; // 평평 → 중앙(h/2)
    }),
    'sparklinePoints: 평평하면 중앙 수평선'
  );
}

// ── 인앱 웹뷰 감지 (in-app-browser) ──────────────────────────
{
  const IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 Instagram 300.0';
  const FB = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537 FBAN/EMA;FBAV/400';
  const KAKAO = 'Mozilla/5.0 (iPhone) AppleWebKit/605 KAKAOTALK 10.0.0';
  const CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 CriOS/120 Mobile';
  const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 Version/17 Safari';

  ok(isInAppBrowser(IG), 'in-app: 인스타 감지');
  ok(isInAppBrowser(FB), 'in-app: 페북 감지');
  ok(isInAppBrowser(KAKAO), 'in-app: 카톡 감지');
  ok(!isInAppBrowser(CHROME), 'in-app: 크롬은 아님');
  ok(!isInAppBrowser(SAFARI), 'in-app: 사파리는 아님');
  ok(!isInAppBrowser(null), 'in-app: null 안전');
  ok(!isInAppBrowser(''), 'in-app: 빈 문자열 안전');
  eq(inAppBrowserName(IG), '인스타그램', 'in-app: 이름 인스타');
  eq(inAppBrowserName(KAKAO), '카카오톡', 'in-app: 이름 카톡');
  eq(inAppBrowserName(CHROME), '앱', 'in-app: 미지정 폴백');
}

// ── 연승/폼 하이라이트 (streak-card) ─────────────────────────
{
  const base = { currentStreak: 0, bestWinStreak: 0, momentum: 0, winRate: 50 };
  eq(streakLabel({ ...base, currentStreak: 5 }).text, '5연승 중', 'streak: 5연승');
  eq(streakLabel({ ...base, currentStreak: 5 }).color, 'gold', 'streak: 5연승 gold');
  eq(streakLabel({ ...base, currentStreak: 3 }).color, 'lime', 'streak: 3연승 lime');
  eq(streakLabel({ ...base, currentStreak: -3 }).text, '3연패 중', 'streak: 3연패 텍스트');
  eq(streakLabel({ ...base, currentStreak: -3 }).color, 'lose', 'streak: 3연패 lose');
  eq(streakLabel({ ...base, momentum: 25 }).text, '폼 상승 중', 'streak: 모멘텀 상승');
  eq(streakLabel({ ...base, momentum: -25 }).color, 'lose', 'streak: 모멘텀 하락 lose');
  eq(streakLabel(base).text, '안정적인 폼', 'streak: 사건 없으면 안정');
  ok(['▲', '▼', '◆'].includes(streakLabel(base).icon), 'streak: icon은 카드 안전 기호');

  ok(hasStreakHighlight({ ...base, currentStreak: 2 }), 'highlight: 2연승 노출');
  ok(hasStreakHighlight({ ...base, currentStreak: -2 }), 'highlight: 2연패 노출');
  ok(hasStreakHighlight({ ...base, momentum: 20 }), 'highlight: 모멘텀 노출');
  ok(!hasStreakHighlight(base), 'highlight: 사건 없으면 숨김');
  ok(!hasStreakHighlight({ ...base, currentStreak: 1 }), 'highlight: 1연승은 숨김');
}

// ── 천적 선정 (pickNemesis) ──────────────────────────────────
{
  const R = (nickname: string, win: number, lose: number, games = win + lose): Rival =>
    ({ nickname, win, draw: 0, lose, games, goalsFor: 0, goalsAgainst: 0 });
  eq(pickNemesis([R('A', 2, 5)])?.nickname, 'A', 'nemesis: 2승5패는 천적');
  eq(pickNemesis([R('A', 4, 5)]), null, 'nemesis: 1점차는 천적 아님(diff>-2)');
  eq(pickNemesis([R('A', 1, 1, 2)]), null, 'nemesis: 3경기 미만 제외');
  eq(pickNemesis([R('A', 3, 3)]), null, 'nemesis: 동률은 천적 아님');
  // 가장 크게 지는 상대 우선
  eq(pickNemesis([R('A', 2, 5), R('B', 1, 6)])?.nickname, 'B', 'nemesis: 최대 열세 우선');
  // 동률 열세면 최다 대전
  eq(
    pickNemesis([R('A', 2, 5, 7), R('B', 3, 6, 12)])?.nickname,
    'B',
    'nemesis: 동일 열세면 최다 대전'
  );
  eq(pickNemesis([]), null, 'nemesis: 빈 배열 null');
}

// ── 주간 결산 (weeklyRecap) ──────────────────────────────────
{
  const NOW = Date.parse('2026-08-31T12:00:00Z');
  const wm = (daysAgo: number, result: '승' | '무' | '패', myGoals = 1, oppGoals = 0, forfeit = false): MatchSummary => ({
    matchId: `${daysAgo}-${result}-${myGoals}`,
    matchDate: new Date(NOW - daysAgo * 86400000).toISOString().replace('Z', ''),
    matchType: 50,
    result,
    forfeit,
    me: { nickname: 'me', goals: myGoals, possession: 50, rating: 7 },
    opponent: { nickname: 'opp', goals: oppGoals },
  });

  // 최근 7일 윈도잉: 8일 전 경기는 제외
  const r = weeklyRecap([wm(1, '승', 3, 1), wm(2, '승', 2, 0), wm(3, '패', 0, 2), wm(8, '승', 5, 0)], NOW);
  eq(r.games, 3, 'weekly: 7일 밖(8일 전) 제외');
  eq(r.win, 2, 'weekly: 승 집계');
  eq(r.lose, 1, 'weekly: 패 집계');
  eq(r.winRate, 67, 'weekly: 승률 반올림(2/3)');
  eq(r.goalsFor, 5, 'weekly: 득점 합(3+2+0)');
  eq(r.goalsAgainst, 3, 'weekly: 실점 합(1+0+2)');

  // 연승은 시간순으로 계산 (최신순 입력이어도)
  const streak = weeklyRecap([wm(1, '승'), wm(2, '승'), wm(3, '승'), wm(4, '패')], NOW);
  eq(streak.bestStreak, 3, 'weekly: 주간 최다 연승(시간순)');

  // 빈 주
  const empty = weeklyRecap([wm(10, '승'), wm(20, '패')], NOW);
  eq(empty.games, 0, 'weekly: 최근 7일 경기 없으면 0');
  eq(empty.winRate, 0, 'weekly: 빈 주 승률 0');
  eq(empty.best, null, 'weekly: 빈 주 최고 경기 null');

  // 몰수는 최고 경기 후보에서 제외(집계엔 포함)
  const ff = weeklyRecap([wm(1, '승', 9, 0, true), wm(2, '승', 2, 1, false)], NOW);
  eq(ff.games, 2, 'weekly: 몰수도 경기수 포함');
  ok(ff.best !== null && ff.best.matchId === '2-승-2', 'weekly: 최고 경기는 몰수 제외');
}


// ── 앱 응답 계약 (checkShape / ROUTES) ────────────────────────
// 앱은 응답을 Swift Decodable 로 디코딩한다 — 필수 필드가 하나만 없어도 응답 전체가 실패한다.
// 여기서 검증기 자체를 테스트하고, 계약 정의가 스스로 모순되지 않는지 확인한다.
// 실제 응답 대조는 `npm run verify:api -- <baseUrl>` 가 담당한다.
{
  section('api-contract');

  const shape = { a: 'string', b: 'int', 'c?': 'string', rows: 'int[]' };

  eq(checkShape(shape, { a: 'x', b: 1, c: null, rows: [1, 2] }), [], 'contract: 정상 응답은 위반 0');
  eq(checkShape(shape, { a: 'x', b: 1, rows: [] }), [], 'contract: 옵셔널 필드는 없어도 통과');

  // 필드 삭제 — 가장 흔한 파괴적 변경
  const missing = checkShape(shape, { b: 1, rows: [] });
  eq(missing.length, 1, 'contract: 필수 필드 누락 1건');
  eq(missing[0].kind, 'missing', 'contract: 누락은 missing 으로 분류');
  eq(missing[0].path, 'a', 'contract: 누락 경로 보고');

  // 필수 필드가 null 이 되는 것도 파괴적 변경
  const nulled = checkShape(shape, { a: null, b: 1, rows: [] });
  eq(nulled.length, 1, 'contract: 필수 필드 null 1건');
  eq(nulled[0].kind, 'null', 'contract: null 은 null 로 분류');

  // 타입 변경
  eq(checkShape(shape, { a: 1, b: 1, rows: [] })[0].kind, 'type', 'contract: 타입 불일치 감지');
  // Swift Int 는 소수를 못 받는다
  eq(checkShape(shape, { a: 'x', b: 1.5, rows: [] })[0].kind, 'type', 'contract: int 자리에 소수는 위반');
  eq(checkShape({ b: 'number' }, { b: 1.5 }), [], 'contract: number 자리의 소수는 정상');

  // 배열이 객체로 바뀌는 경우
  eq(checkShape(shape, { a: 'x', b: 1, rows: {} })[0].kind, 'not-array', 'contract: 배열 아님 감지');
  eq(checkShape(shape, { a: 'x', b: 1, rows: ['x'] })[0].kind, 'type', 'contract: 배열 원소 타입 검사');

  // 필드 추가는 위반이 아니다 — 앱은 모르는 키를 무시한다
  eq(checkShape(shape, { a: 'x', b: 1, rows: [], brandNew: 123 }), [], 'contract: 필드 추가는 허용');

  // 중첩 구조 경로 보고
  const nestedShape = { me: 'SummaryMe' };
  const nested = checkShape(nestedShape, { me: { nickname: 'n', goals: 1, possession: 50 } });
  eq(nested.length, 1, 'contract: 중첩 누락 1건');
  eq(nested[0].path, 'me.rating', 'contract: 중첩 경로를 점으로 이어 보고');

  // 최상위가 객체가 아닌 경우(오류 응답이 그대로 온 경우 등)
  eq(checkShape(shape, null)[0].kind, 'not-object', 'contract: null 응답 감지');
  eq(checkShape(shape, [])[0].kind, 'not-object', 'contract: 배열 응답 감지');

  // 정의되지 않은 라우트는 검사 대상이 아니다
  eq(checkRoute('GET /api/v1/does-not-exist', { anything: 1 }), [], 'contract: 미정의 라우트는 통과');

  // ── 계약 정의 자체의 무결성 ──
  // 참조하는 SHAPES 이름이 전부 존재해야 한다. 오타 하나로 검증이 조용히 무력화되는 걸 막는다.
  const known = new Set(['string', 'int', 'number', 'bool', 'any']);
  const unresolved: string[] = [];
  const visit = (where: string, sh: Record<string, string>) => {
    for (const [k, spec] of Object.entries(sh)) {
      const base = spec.endsWith('[]') ? spec.slice(0, -2) : spec;
      if (!known.has(base) && !SHAPES[base]) unresolved.push(`${where}.${k} → '${base}'`);
    }
  };
  for (const [name, sh] of Object.entries(SHAPES)) visit(`SHAPES.${name}`, sh);
  for (const [name, sh] of Object.entries(ROUTES)) visit(`ROUTES['${name}']`, sh);
  eq(unresolved, [], 'contract: 정의되지 않은 스펙 참조 없음');

  // 라우트가 실수로 비지 않았는지 (빈 계약은 모든 응답을 통과시킨다)
  const emptyRoutes = Object.entries(ROUTES).filter(([, sh]) => Object.keys(sh).length === 0).map(([k]) => k);
  eq(emptyRoutes, [], 'contract: 빈 라우트 계약 없음');
  ok(Object.keys(ROUTES).length >= 11, `contract: 라우트 계약 11개 이상 (현재 ${Object.keys(ROUTES).length})`);
}


// ── 앱 사용 기록 검증 (sanitizeEvents) ────────────────────────
// 공개 엔드포인트라 받은 값을 그대로 저장하면 안 된다. 거부보다 정리 — 구버전 앱의 모르는 필드는 버리고 나머지는 살린다.
{
  section('analytics');
  const NOW = Date.parse('2026-09-15T12:00:00Z');
  const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

  eq(sanitizeEvents(null, NOW), null, 'events: null 입력 거부');
  eq(sanitizeEvents({ installId: 'not-a-uuid', events: [] }, NOW), null, 'events: 설치 ID 형식 오류 거부');

  const ok1 = sanitizeEvents({ installId: ID.toUpperCase(), appVersion: '1.0.0', env: 'appstore',
    events: [{ name: 'card_share', props: { type: 'match', channel: 'instagram' }, at: '2026-09-15T11:59:00Z' }] }, NOW);
  eq(ok1?.installId, ID, 'events: 설치 ID 소문자 정규화');
  eq(ok1?.events.length, 1, 'events: 정상 이벤트 1건');
  eq(ok1?.events[0].props, { type: 'match', channel: 'instagram' }, 'events: props 보존');
  eq(ok1?.env, 'appstore', 'events: env 보존');

  const mixed = sanitizeEvents({ installId: ID, events: [{ name: 'drop_table' }, { name: 'search' }, 'junk'] }, NOW);
  eq(mixed?.events.map((e) => e.name), ['search'], 'events: 허용 목록 밖 이름·잘못된 항목 제거');

  const props = sanitizeEvents({ installId: ID, events: [{ name: 'search', props: {
    ok: true, n: 3, bad_obj: { a: 1 }, 'Bad-Key': 'x', long: 'x'.repeat(200), inf: Infinity,
  } }] }, NOW);
  eq(props?.events[0].props.bad_obj, undefined, 'events: 중첩 객체 제거');
  eq(props?.events[0].props['Bad-Key'], undefined, 'events: 키 형식 위반 제거');
  eq((props?.events[0].props.long as string).length, 60, 'events: 문자열 60자 제한');
  eq(props?.events[0].props.inf, undefined, 'events: 무한대 숫자 제거');
  eq(props?.events[0].props.ok, true, 'events: 불리언 보존');

  const future = sanitizeEvents({ installId: ID, events: [{ name: 'search', at: '2030-01-01T00:00:00Z' }] }, NOW);
  eq(future?.events[0].at, new Date(NOW).toISOString(), 'events: 미래 시각은 수신 시각으로');
  const old = sanitizeEvents({ installId: ID, events: [{ name: 'search', at: '2026-01-01T00:00:00Z' }] }, NOW);
  eq(old?.events[0].at, new Date(NOW).toISOString(), 'events: 7일 넘은 시각은 수신 시각으로');

  const many = sanitizeEvents({ installId: ID, events: Array.from({ length: 80 }, () => ({ name: 'search' })) }, NOW);
  eq(many?.events.length, MAX_EVENTS, 'events: 배치 50개 상한');
  eq(sanitizeEvents({ installId: ID, env: 'prod', events: [] }, NOW)?.env, 'unknown', 'events: 모르는 env 는 unknown');
}

// ── 넥슨 오류 분류 (없는 닉네임 → 404, 매치 ID 형식) ─────────
section('nexon-errors');
{
  const nx = (status: number, code: string, message = '') => ({ name: 'NexonApiError', status, code, message });
  ok(isOuidLookupNotFound(nx(400, 'OPENAPI00004', 'Please input valid parameter')), 'ouid: 00004 파라미터 오류 = 없는 닉네임');
  ok(isOuidLookupNotFound(nx(400, 'OPENAPI00003', 'Please input valid identifier')), 'ouid: 00003 = 없는 닉네임');
  ok(isOuidLookupNotFound(nx(400, 'HTTP400', 'Please input valid parameter')), 'ouid: 코드 없으면 메시지로 판별');
  ok(!isOuidLookupNotFound(nx(400, 'HTTP400', '넥슨 API 오류 (HTTP 400)')), 'ouid: 본문 없는 400 은 not-found 아님');
  ok(!isOuidLookupNotFound(nx(400, 'OPENAPI00005', 'Please input valid API key')), 'ouid: API 키 오류는 not-found 아님');
  ok(!isOuidLookupNotFound(nx(400, 'OPENAPI00009', 'Please input valid parameter')), 'ouid: 데이터 준비 중(00009)은 not-found 아님');
  ok(!isOuidLookupNotFound(nx(400, 'OPENAPI00010')), 'ouid: 점검(00010)은 not-found 아님');
  ok(!isOuidLookupNotFound(nx(500, 'OPENAPI00004', 'Please input valid parameter')), 'ouid: 5xx 는 not-found 아님');
  ok(!isOuidLookupNotFound(nx(429, 'OPENAPI00007')), 'ouid: 429 는 not-found 아님');
  ok(!isOuidLookupNotFound(nx(504, 'TIMEOUT')), 'ouid: 타임아웃은 not-found 아님');
  ok(!isOuidLookupNotFound({ name: 'Error', status: 400, code: 'OPENAPI00004' }), 'ouid: NexonApiError 가 아니면 false');
  ok(!isOuidLookupNotFound(null), 'ouid: null');

  ok(MATCH_ID_RE.test('6aa554a2e0ba2d88c7d0c505'), 'matchId: 실측 형식 통과');
  ok(!MATCH_ID_RE.test('zzzz'), 'matchId: zzzz 거부');
  ok(!MATCH_ID_RE.test('6AA554A2E0BA2D88C7D0C505'), 'matchId: 대문자 거부');
  ok(!MATCH_ID_RE.test('6aa554a2e0ba2d88c7d0c50'), 'matchId: 23자 거부');
  ok(!MATCH_ID_RE.test('6aa554a2e0ba2d88c7d0c505/x'), 'matchId: 경로 문자 거부');
}

// ── UGC 금칙어 필터 (App Store 1.2) ──────────────────────────
section('moderation');
{
  const banned = [
    '씨발', '시발 뭐냐', 'ㅅㅂ', '병신같네', 'ㅂㅅ', '좆같다', '개새끼', '니애미', '느금마', '존나 못하네', '지랄하네',
    // 우회 변형: 숫자·기호·라틴·이모지 삽입, 한 글자씩 띄어쓰기, 전각, 영타
    '씨1발', '시.발', '씨 발', '병 신', 'ㅅ ㅂ', '개 새끼', '씨a발', '시🤬발', 'ｓｈｉｔ', 'tlqkf',
    'fuck you', 'F.U.C.K', 'sh1t', 'cunt',
    // 스팸
    '바카라 사이트 홍보', '카지노 첫 입금', 'totocasino.com 가입', 'bet365.com', '조건만남',
  ];
  for (const t of banned) ok(findBannedTerm(t) !== null, `moderation: 차단돼야 함 — ${t}`);

  const clean = [
    '시발점', '시발역에서 출발', '다시 발로 찼다', '날씨 벌써 추워요', '슈바인슈타이거 카드 좋네요', '곱씹어 보면 명경기',
    'hamstring niggle', 'Scunthorpe United', 'goals hit the post', '3개년 계획', '오피셜 떴다', '보지 마세요',
    '자지 말고 랭겜', '토토 스킬라치 아이콘', '졸라 아이콘 카드', '니 미드필더 좋네', '4-2-3-1 포메이션 추천',
    '후쿠다 fukuda', '오픈채팅 https://open.kakao.com/o/abc123', '새끼손가락 부상', '미친 중거리슛',
    '첫 충전 이벤트', '발롱도르 메시', 'alphabet.com', '병장 신병 둘다 환영', '손흥민팬',
  ];
  for (const t of clean) eq(findBannedTerm(t), null, `moderation: 통과해야 함 — ${t}`);

  ok(containsBannedWords(null, '', '좋은 글', '씨발'), 'moderation: 여러 필드 중 하나라도 걸리면 true');
  ok(!containsBannedWords(null, undefined, '', '좋은 글'), 'moderation: 빈/정상 필드만이면 false');
}

// ── 푸시 정책 (APNS_SANDBOX 해석·무효 토큰·삭제 브레이커) ─────
section('push-policy');
{
  eq(apnsHost(undefined), APNS_PRODUCTION, 'apns: 미설정 = 운영');
  eq(apnsHost(''), APNS_PRODUCTION, 'apns: 빈 값 = 운영');
  eq(apnsHost('0'), APNS_PRODUCTION, 'apns: "0" = 운영 (truthy 버그 회귀)');
  eq(apnsHost('false'), APNS_PRODUCTION, 'apns: "false" = 운영 (truthy 버그 회귀)');
  eq(apnsHost('yes'), APNS_PRODUCTION, 'apns: 모르는 값 = 운영');
  eq(apnsHost('1'), APNS_SANDBOX, 'apns: "1" = 샌드박스');
  eq(apnsHost('true'), APNS_SANDBOX, 'apns: "true" = 샌드박스');
  eq(apnsHost(' TRUE '), APNS_SANDBOX, 'apns: 대소문자·공백 허용');

  ok(isDeadToken({ token: 't', status: 410 }), 'push: 410 Unregistered = 무효');
  ok(isDeadToken({ token: 't', status: 400, reason: 'BadDeviceToken' }), 'push: BadDeviceToken = 무효');
  ok(isDeadToken({ token: 't', status: 400, reason: 'DeviceTokenNotForTopic' }), 'push: DeviceTokenNotForTopic = 무효');
  ok(!isDeadToken({ token: 't', status: 400, reason: 'BadTopic' }), 'push: 다른 400 사유는 무효 아님');
  ok(!isDeadToken({ token: 't', status: 403, reason: 'InvalidProviderToken' }), 'push: 키 오류(403)는 무효 아님');
  ok(!isDeadToken({ token: 't', status: 0, reason: 'session_error' }), 'push: 세션 오류(status 0)는 무효 아님');

  eq(deadTokenDecision(10, 0), { delete: false, tripped: false }, 'breaker: 무효 0 → 할 일 없음');
  eq(deadTokenDecision(10, 5), { delete: true, tripped: false }, 'breaker: 정확히 50% 는 삭제');
  eq(deadTokenDecision(10, 6), { delete: false, tripped: true }, 'breaker: 50% 초과는 삭제 건너뜀');
  eq(deadTokenDecision(5, 5), { delete: false, tripped: true }, 'breaker: 5개 중 5개 무효 → 건너뜀');
  eq(deadTokenDecision(4, 4), { delete: true, tripped: false }, 'breaker: 5개 미만 배치는 삭제 허용');
  eq(deadTokenDecision(1000, 1000), { delete: false, tripped: true }, 'breaker: 전량 무효(환경 오류) → 건너뜀');
}

// ── 디바이스 등록 입력 정리 (/api/v1/devices) ────────────────
section('device-input');
{
  const ch = (cp: number) => String.fromCharCode(cp);
  eq(cleanDeviceText('  손흥민 '), '손흥민', 'devices: trim');
  eq(cleanDeviceText(`a${ch(0)}b${ch(0x202e)}c${ch(0x200b)}d${ch(10)}`), 'abcd', 'devices: 제어·bidi·zero-width 제거');
  eq(cleanDeviceText(''), null, 'devices: 빈 문자열은 null');
  eq(cleanDeviceText(`  ${ch(0x200b)} `), null, 'devices: 보이지 않는 문자만이면 null');
  eq(cleanDeviceText(123), null, 'devices: 문자열 아니면 null');
  eq(cleanDeviceText('가'.repeat(50))?.length, 40, 'devices: 40자 상한');
  eq(Array.from(cleanDeviceText('😀'.repeat(50)) ?? '').length, 40, 'devices: 코드포인트 기준 자르기(서로게이트 안 깨짐)');
  eq(cleanDeviceText('1.2.3-build-long-version', 20), '1.2.3-build-long-ver', 'devices: appVersion 20자');

  eq(sanitizeFavorites(['a', ' a ', '', '   ', 'b', 5, null, 'x'.repeat(60)]), ['a', 'b', 'x'.repeat(40)], 'favorites: 정리·빈값 제거·중복 제거·40자');
  eq(sanitizeFavorites(Array.from({ length: 30 }, (_, i) => `n${i}`)).length, 12, 'favorites: 최대 12개');
  eq(sanitizeFavorites([...Array.from({ length: 20 }, () => ''), 'late']), ['late'], 'favorites: 빈 값은 12개 상한에 안 셈');
  eq(sanitizeFavorites('abc'), [], 'favorites: 배열 아니면 빈 배열');
}

// ── 결과 ─────────────────────────────────────────────────────
// 등록된 비동기 테스트를 모두 돌린 뒤 집계한다.
void (async () => {
  for (const t of asyncTests) {
    try {
      await t.run();
    } catch (err) {
      fails.push(`${t.name} — 예외: ${(err as Error)?.message ?? String(err)}`);
    }
  }

  console.log(`\n단위 테스트: ${pass} PASS, ${fails.length} FAIL`);
  if (fails.length) {
    console.log('\n실패:');
    for (const f of fails) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('✓ 전부 통과');
})();
