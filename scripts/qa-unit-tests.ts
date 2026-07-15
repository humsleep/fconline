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
import { summarizeMatch, aggregate, topRivals } from '../lib/nexon/summary';
import { verdictFromRating, verdictFromMatch } from '../lib/verdict';
import { rateLimit, clientIp } from '../lib/security/rate-limit';
import { hashIp, clientIpFrom } from '../lib/security/ip-hash';
import { getPositionLabel } from '../lib/nexon/meta';
import { baseLabelOfCode, assignByPosition, bestFormationId } from '../lib/squad/assign';
import { formatKoreanBP, formatKoreanBPShort } from '../lib/format';
import { MARKET_RULES, computeMarketStats, diagnoseMarket } from '../lib/market/diagnosis';
import type { TradeRecord } from '../lib/nexon/types';
import { getPreset, presetsByLeague } from '../lib/squad/presets';
import { aggregatePlaystyle, analyzePlaystyle } from '../lib/playstyle';
import { squadCardTree } from '../lib/card/squad-card';
import { POST_TYPES, isPostType } from '../lib/community/post-types';
import type { Squad } from '../lib/squad/store';

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

// ── formatKoreanBP (억/조/경 단위) ───────────────────────────
section('formatKoreanBP');
eq(formatKoreanBP(0), '0', '0');
eq(formatKoreanBP(9_999), '9,999', '만 미만은 그대로');
eq(formatKoreanBP(475_000_000), '4억 7,500만', '억+만 조합');
eq(formatKoreanBP(200_000_000), '2억', '나머지 0이면 단일 단위');
eq(formatKoreanBP(1_234_000_000_000), '1조 2,340억', '조+억 조합');
eq(formatKoreanBP(30_000_000_000_000_000), '3경', '경 단위');
eq(formatKoreanBPShort(475_000_000), '4.75억', '축약 소수 2자리');
eq(formatKoreanBPShort(12_300_000_000), '123억', '축약 100 이상 정수');
eq(formatKoreanBPShort(45_600_000_000), '456억', '축약 정수');
eq(formatKoreanBPShort(2_000_000_000_000), '2조', '축약 후행 0 제거');

// ── 이적시장 진단 (사전 셋팅 룰) ─────────────────────────────
section('market-diagnosis');
ok(MARKET_RULES.length >= 100, `진단 룰 100개 이상 (현재 ${MARKET_RULES.length}개)`);
eq(new Set(MARKET_RULES.map((r) => r.id)).size, MARKET_RULES.length, '룰 id 중복 없음');
ok(MARKET_RULES.every((r) => r.title.length > 0 && r.desc.length > 0), '모든 룰에 제목·설명 존재');
ok(MARKET_RULES.some((r) => r.kind === 'type') && MARKET_RULES.some((r) => r.kind === 'note'), 'type/note 룰 모두 존재');

const NOW = Date.parse('2026-07-15T12:00:00Z');
const trade = (daysAgo: number, value: number, grade = 1, spid = 251000001): TradeRecord =>
  ({ tradeDate: new Date(NOW - daysAgo * 86400000).toISOString(), saleSn: `${daysAgo}-${value}-${spid}`, spid, grade, value }) as TradeRecord;

// 큰손 흑자: 1조 지출 + 그 이상 수입
const whale = computeMarketStats(
  [trade(1, 1.2e12, 8), trade(2, 3e11, 9)],
  [trade(0, 2e12), trade(3, 5e11)],
  NOW
);
eq(diagnoseMarket(whale).type?.id, 't-whale-surplus', '큰손 흑자 유형 판정');
ok(diagnoseMarket(whale).notes.length > 0 && diagnoseMarket(whale).notes.length <= 4, '코멘트 1~4개');

// 빈 데이터 → 진단 없음
eq(diagnoseMarket(computeMarketStats([], [], NOW)).type, null, '거래 없으면 진단 없음');

// 어떤 조합에도 type 폴백 매칭 (fallback 룰 존재)
const tiny = computeMarketStats([trade(0, 5000)], [], NOW);
ok(diagnoseMarket(tiny).type !== null, '소액 1건도 유형 폴백 매칭');

// 지표 계산 검증
eq(whale.totalBuy, 1.5e12, 'totalBuy 합산');
eq(whale.net, 1e12, 'net 계산');
eq(whale.highGradeBuys, 2, '8강 이상 영입 수');
eq(tiny.daysSinceLast, 0, 'daysSinceLast 오늘 = 0');

// 모든 룰의 when이 대표 스탯 3종에서 예외 없이 실행됨
for (const st of [whale, tiny, computeMarketStats([], [], NOW)]) {
  let threw = false;
  try {
    for (const r of MARKET_RULES) r.when(st);
  } catch {
    threw = true;
  }
  ok(!threw, '룰 평가 중 예외 없음');
}

// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n단위 테스트: ${pass} PASS, ${fails.length} FAIL`);
if (fails.length) {
  console.log('\n실패:');
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('✓ 전부 통과');
