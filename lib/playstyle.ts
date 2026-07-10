import type { MatchDetail, MatchInfoEntry } from './nexon/types';

/**
 * 플레이스타일 룰베이스 엔진 (회의 스펙, docs/PLAYSTYLE-SPEC.md).
 * v1 콜드스타트: tier별 고정 anchor + 절대 임계 폴백 + empirical-Bayes 수축.
 * 코호트 데이터가 쌓이면 v2에서 (tier×ctrl) 백분위로 승급. AI 호출 없음.
 */

// ── 집계 (내 시점, 유효 경기만)
export interface PlayRaw {
  games: number;
  possession: number; // 평균 점유율
  passTry: number;
  passSuccess: number;
  shortPassSuccess: number;
  longPassTry: number;
  throughTry: number;
  throughSuccess: number;
  lobbedTry: number;
  dribble: number;
  effShoot: number;
  shootTotal: number;
  boxShots: number; // inPenalty 슛 수
  goals: number;
  tackleTry: number;
  tackleSuccess: number;
  blockTry: number;
  foul: number;
  offside: number;
  controller: string; // 최빈 컨트롤러
}

function isValidGame(e: MatchInfoEntry, d: MatchDetail): boolean {
  // 몰수·초단시간(패스 극소) 경기 제외
  if ((e.matchDetail?.matchEndType ?? 0) !== 0) return false;
  if ((e.pass?.passTry ?? 0) < 10) return false;
  void d;
  return true;
}

export function aggregatePlaystyle(
  matches: MatchDetail[],
  ouid: string
): PlayRaw {
  const r: PlayRaw = {
    games: 0, possession: 0, passTry: 0, passSuccess: 0, shortPassSuccess: 0,
    longPassTry: 0, throughTry: 0, throughSuccess: 0, lobbedTry: 0, dribble: 0,
    effShoot: 0, shootTotal: 0, boxShots: 0, goals: 0, tackleTry: 0,
    tackleSuccess: 0, blockTry: 0, foul: 0, offside: 0, controller: 'unknown',
  };
  let possSum = 0;
  const ctrlCount = new Map<string, number>();

  for (const d of matches) {
    const e = d.matchInfo?.find((m) => m.ouid === ouid);
    if (!e || !isValidGame(e, d)) continue;
    r.games += 1;
    possSum += e.matchDetail?.possession ?? 0;
    r.passTry += e.pass?.passTry ?? 0;
    r.passSuccess += e.pass?.passSuccess ?? 0;
    r.shortPassSuccess += e.pass?.shortPassSuccess ?? 0;
    r.longPassTry += e.pass?.longPassTry ?? 0;
    r.throughTry += e.pass?.throughPassTry ?? 0;
    r.throughSuccess += e.pass?.throughPassSuccess ?? 0;
    r.lobbedTry += e.pass?.lobbedThroughPassTry ?? 0;
    r.dribble += e.matchDetail?.dribble ?? 0;
    r.effShoot += e.shoot?.effectiveShootTotal ?? 0;
    r.shootTotal += e.shoot?.shootTotal ?? 0;
    r.boxShots += (e.shootDetail ?? []).filter((s) => s.inPenalty).length;
    r.goals += e.shoot?.goalTotal ?? 0;
    r.tackleTry += e.defence?.tackleTry ?? 0;
    r.tackleSuccess += e.defence?.tackleSuccess ?? 0;
    r.blockTry += e.defence?.blockTry ?? 0;
    r.foul += e.matchDetail?.foul ?? 0;
    r.offside += e.matchDetail?.offsideCount ?? 0;
    const c = e.matchDetail?.controller || 'unknown';
    ctrlCount.set(c, (ctrlCount.get(c) ?? 0) + 1);
  }

  r.possession = r.games ? possSum / r.games : 0;
  r.controller =
    [...ctrlCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
  return r;
}

// ── 축 계산
function clamp(v: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, v));
}
function map(v: number, lo: number, hi: number): number {
  return clamp(((v - lo) / (hi - lo)) * 100);
}
// empirical-Bayes 수축 (표본 적으면 anchor 중앙값으로 당김)
function shrink(userVal: number, anchor: number, games: number, K = 10): number {
  return (games / (games + K)) * userVal + (K / (games + K)) * anchor;
}

export type Confidence = 'hold' | 'low' | 'ok';

export interface Axis {
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  label: string;
  value: number; // 0~100
  bipolar: boolean;
  leftLabel?: string;
  rightLabel?: string;
  lowConf: boolean;
}

export interface Chip {
  text: string;
  kind: 'strength' | 'weakness';
}

export interface PlaystyleResult {
  confidence: Confidence;
  games: number;
  controller: string;
  beta: true;
  archetype: {
    id: string;
    name: string;
    tagline: string;
    baseStrength: string;
    baseWeakness: string;
  };
  axes: Axis[];
  chips: Chip[];
}

// 콜드스타트 anchor (map 구간 = 하위~상위 앵커). 실데이터 누적 시 배치로 갱신.
const ANCHOR = {
  possLo: 42, possHi: 58,
  shortShareLo: 0.35, shortShareHi: 0.75,
  directShareLo: 0.12, directShareHi: 0.32,
  penShareLo: 0.03, penShareHi: 0.14,
  dribPMLo: 3, dribPMHi: 12,
  shotPMLo: 3, shotPMHi: 9,
  boxRatioLo: 0.45, boxRatioHi: 0.75,
  defPMLo: 6, defPMHi: 18,
  tackleShareLo: 0.4, tackleShareHi: 0.8,
};

export function analyzePlaystyle(r: PlayRaw): PlaystyleResult {
  const G = r.games;
  const controller = r.controller;
  const confidence: Confidence = G < 5 ? 'hold' : G < 15 ? 'low' : 'ok';

  // 파생 지표
  const passAcc = r.passTry ? r.passSuccess / r.passTry : 0;
  const shortShare = r.passSuccess ? r.shortPassSuccess / r.passSuccess : 0;
  const directShare = r.passTry
    ? (r.longPassTry + r.throughTry + r.lobbedTry) / r.passTry
    : 0;
  const penShare = r.passTry ? (r.throughTry + r.lobbedTry) / r.passTry : 0;
  const penEff = r.throughTry ? r.throughSuccess / r.throughTry : 0;
  const dribPM = G ? shrink(r.dribble / G, (ANCHOR.dribPMLo + ANCHOR.dribPMHi) / 2, G) : 0;
  const shotPM = G ? shrink(r.effShoot / G, (ANCHOR.shotPMLo + ANCHOR.shotPMHi) / 2, G) : 0;
  const boxRatio = r.shootTotal ? r.boxShots / r.shootTotal : 0.5;
  const defPM = G ? shrink((r.tackleTry + r.blockTry) / G, (ANCHOR.defPMLo + ANCHOR.defPMHi) / 2, G) : 0;
  const tackleShare = r.tackleTry + r.blockTry ? r.tackleTry / (r.tackleTry + r.blockTry) : 0.5;
  const blockShare = 1 - tackleShare;
  const conv = r.effShoot ? r.goals / r.effShoot : 0;
  const tackleSuccessRate = r.tackleTry ? r.tackleSuccess / r.tackleTry : 0;
  const foulPM = G ? r.foul / G : 0;
  const offsidePM = G ? r.offside / G : 0;

  // 축 (0~100)
  const A = clamp(
    0.45 * (100 - map(r.possession, ANCHOR.possLo, ANCHOR.possHi)) +
      0.3 * (100 - map(shortShare, ANCHOR.shortShareLo, ANCHOR.shortShareHi)) +
      0.25 * map(directShare, ANCHOR.directShareLo, ANCHOR.directShareHi)
  );
  const B = clamp(
    map(penShare, ANCHOR.penShareLo, ANCHOR.penShareHi) * (0.7 + 0.3 * penEff)
  );
  const C = map(dribPM, ANCHOR.dribPMLo, ANCHOR.dribPMHi);
  const D = clamp(
    0.5 * map(shotPM, ANCHOR.shotPMLo, ANCHOR.shotPMHi) +
      0.5 * (100 - map(boxRatio, ANCHOR.boxRatioLo, ANCHOR.boxRatioHi))
  );
  const E = clamp(
    0.7 * map(defPM, ANCHOR.defPMLo, ANCHOR.defPMHi) +
      0.3 * map(tackleShare, ANCHOR.tackleShareLo, ANCHOR.tackleShareHi)
  );

  // 축별 저신뢰 게이트
  const passLow = r.passTry < 150;
  const shootLow = r.effShoot < 25;
  const axes: Axis[] = [
    { key: 'A', label: '전개 템포', value: A, bipolar: true, leftLabel: '점유·지공', rightLabel: '직선·역습', lowConf: passLow },
    { key: 'B', label: '스루 침투', value: B, bipolar: false, lowConf: passLow || r.throughTry < 20 },
    { key: 'C', label: '개인기', value: C, bipolar: false, lowConf: false },
    { key: 'D', label: '슈팅 성향', value: D, bipolar: true, leftLabel: '박스 집중', rightLabel: '외곽 다작', lowConf: shootLow },
    { key: 'E', label: '수비 압박', value: E, bipolar: false, lowConf: false },
  ];

  const archetype = pickArchetype({ A, B, C, D, E, G, possession: r.possession, boxRatio, blockShare, passAcc, shotPM });

  // 강점/취약 칩 (실행품질 오버레이)
  const chips: Chip[] = [];
  if (confidence !== 'hold') {
    const s: Chip[] = [];
    if (penEff > 0.55 && r.throughTry >= 20) s.push({ kind: 'strength', text: `스루 성공률 ${Math.round(penEff * 100)}% — 침투 정확` });
    if (conv > 0.28 && !shootLow) s.push({ kind: 'strength', text: `결정력 상위 — 유효슛 대비 ${Math.round(conv * 100)}% 전환` });
    if (tackleSuccessRate > 0.6 && r.tackleTry >= 20) s.push({ kind: 'strength', text: `압박 성공률 ${Math.round(tackleSuccessRate * 100)}% — 탈취 후 전환` });
    if (boxRatio > 0.72 && !shootLow) s.push({ kind: 'strength', text: '박스 안 슛 집중 — 위치선정 우수' });
    if (passAcc > 0.85 && !passLow) s.push({ kind: 'strength', text: `패스 성공률 ${Math.round(passAcc * 100)}% — 턴오버 최소` });

    const w: Chip[] = [];
    if (conv < 0.15 && !shootLow) w.push({ kind: 'weakness', text: '결정력 하위 — 기회 낭비 많음' });
    if (foulPM > 12) w.push({ kind: 'weakness', text: `경기당 파울 ${foulPM.toFixed(1)} — 세트피스·경고 리스크` });
    if (penEff < 0.35 && B > 60 && r.throughTry >= 20) w.push({ kind: 'weakness', text: '스루 차단 잦음 — 턴오버→역습 노출' });
    if (offsidePM > 3) w.push({ kind: 'weakness', text: `오프사이드 잦음 — 침투 타이밍 조율 필요` });
    if (r.possession < 45 && A > 60) w.push({ kind: 'weakness', text: '선제 실점 시 뒤집을 볼 소유력 부족' });

    chips.push(...s.slice(0, 3), ...w.slice(0, 2));
  }

  return { confidence, games: G, controller, beta: true, archetype, axes, chips };
}

interface AxisSnapshot {
  A: number; B: number; C: number; D: number; E: number;
  G: number; possession: number; boxRatio: number; blockShare: number;
  passAcc: number; shotPM: number;
}

const HIGH = 70;
const LOW = 30;

function pickArchetype(x: AxisSnapshot) {
  const A = (id: string, name: string, tagline: string, baseStrength: string, baseWeakness: string) => ({ id, name, tagline, baseStrength, baseWeakness });

  if (x.G < 5)
    return A('hold', '데이터 수집 중', '경기가 더 쌓이면 유형을 알려드려요', '—', '—');

  // 결정리스트 — 첫 매칭 채택 (실력 지표 미투입)
  if (x.shotPM < 35 && x.possession < 47 && x.blockShare > 0.5)
    return A('tenback', '텐백 카운터', '걸어잠그고 한 방 노리는 실리 수비', '실점 억제·구조 안정, 세트·역습 한 방', '선제 실점 시 반등 화력 부재');
  if (x.E >= HIGH)
    return A('presser', '압박 사냥꾼', '전방부터 물어뜯는 고강도 압박', '높은 볼 탈취로 빌드업 파괴', '압박 실패 시 뒷공간 노출·파울 리스크');
  if (x.B >= 75)
    return A('through', '스루 침투 창조자', '스루패스로 수비 라인을 직접 붕괴', '한 번에 수비 붕괴·고품질 찬스', '차단당하면 턴오버→역습, 오프사이드');
  if (x.C >= 75)
    return A('dribbler', '개인기 드리블러', '1대1로 부수는 개인 캐리형', '드리블 돌파·수적 우위 창출', '돌파 실패 시 즉시 카운터');
  if (x.D <= LOW && x.boxRatio > 0.72)
    return A('poacher', '박스 포처', '적게 쏘고 잘 넣는 위치선정형', '위치선정·마무리 효율 최상', '찬스 적으면 침묵, 빌드업 기여 낮음');
  if (x.D >= 72)
    return A('shooter', '외곽 난사 슈터', '기회만 나면 때리는 다작 슈터', '지속 슈팅으로 세컨볼·코너 유발', '무리한 외곽슛 역습 헌납');
  if (x.A >= HIGH && x.possession < 48)
    return A('counter', '실리 역습가', '빠른 전환으로 찌르는 역습형', '빠른 전환·효율 마무리', '선제 실점 시 전개 정체');
  if (x.A <= LOW && x.passAcc > 0.84)
    return A('tiki', '티키타카 지휘관', '볼 소유로 경기를 지배', '볼 소유로 경기 지배·실책 최소', '밀집 수비에 결정력 부족');
  return A('allround', '밸런스 올라운더', '약점 없는 범용형', '약점 없는 범용성·상황 적응', '결정적 무기 부재');
}
