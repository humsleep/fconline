import type { MatchDetail, MatchInfoEntry, ShootDetail } from './types';
import { summarizeMatch } from './summary';

/**
 * 30경기 통합 분석 리포트 집계 — 이미 가져온 match-detail 배열만으로 계산(넥슨 추가 호출 0).
 * 참고 서비스의 "시간대별 득실 / 슛 타입 / 폼 추세"를 FC Scope식으로 재구성한다.
 * 원칙: 차트는 근거, 자동 인사이트 문장이 주인공(reportInsights).
 */

export interface TimeBand {
  label: string;
  forGoals: number; // 내 득점
  againstGoals: number; // 실점
}

export interface ShotTypeStat {
  key: string;
  label: string;
  tries: number;
  goals: number;
}

export interface FormGame {
  diff: number; // 내 골 - 상대 골
  result: '승' | '무' | '패' | '?';
  label: string; // 툴팁
}

export interface WeeklyForm {
  recentGames: number;
  recentWin: number;
  recentWinRate: number; // 0~100
  prevGames: number;
  prevWinRate: number | null; // 비교 대상 없으면 null
  deltaWinRate: number | null; // recent - prev (%p)
}

export interface MatchReport {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  avgRating: number;
  timeBands: TimeBand[];
  shotTypes: ShotTypeStat[]; // 내 결정력
  form: FormGame[]; // 최신 → 과거
  weekly: WeeklyForm | null; // 최근 7일 vs 직전 7일
}

function goalsOf(entry: MatchInfoEntry): number {
  return entry.shoot?.goalTotalDisplay ?? entry.shoot?.goalTotal ?? 0;
}

// ShotMap.detectGoalCode와 동일 휴리스틱을 lib 계층에 로컬 복제(app→lib 역참조 회피).
function detectGoalCode(sides: { shots: ShootDetail[]; goals: number }[]): number | null {
  const values = new Set<number>();
  for (const s of sides) for (const shot of s.shots) values.add(shot.result);
  const totalGoals = sides.reduce((a, s) => a + s.goals, 0);
  const candidates = [...values].filter(
    (v) =>
      sides.reduce((a, s) => a + s.shots.filter((sh) => sh.result === v).length, 0) ===
      totalGoals
  );
  if (candidates.length === 1) return candidates[0];
  return values.has(3) ? 3 : null;
}

const BAND_LABELS = ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90+'];

// goalTime(초) → 6개 밴드 인덱스. 전/후반 추가시간·연장은 인접 밴드로 흡수(모바일 6밴드로 단순화).
function bandIndex(goalTimeSec: number): number {
  const min = goalTimeSec / 60;
  if (min < 15) return 0;
  if (min < 30) return 1;
  if (min < 45) return 2;
  if (min < 60) return 3;
  if (min < 75) return 4;
  return 5;
}

const SHOT_TYPES: { key: string; label: string; try: keyof NonNullable<MatchInfoEntry['shoot']>; goal: keyof NonNullable<MatchInfoEntry['shoot']> }[] = [
  { key: 'inbox', label: '박스 안', try: 'shootInPenalty', goal: 'goalInPenalty' },
  { key: 'outbox', label: '박스 밖', try: 'shootOutPenalty', goal: 'goalOutPenalty' },
  { key: 'heading', label: '헤딩', try: 'shootHeading', goal: 'goalHeading' },
  { key: 'freekick', label: '프리킥', try: 'shootFreekick', goal: 'goalFreekick' },
  { key: 'penalty', label: '페널티킥', try: 'shootPenaltyKick', goal: 'goalPenaltyKick' },
];

export function aggregateReport(details: MatchDetail[], ouid: string): MatchReport {
  const bands: TimeBand[] = BAND_LABELS.map((label) => ({ label, forGoals: 0, againstGoals: 0 }));
  const shotAgg = new Map<string, { tries: number; goals: number }>();
  for (const t of SHOT_TYPES) shotAgg.set(t.key, { tries: 0, goals: 0 });
  const form: FormGame[] = [];
  const dated: { time: number; result: FormGame['result'] }[] = [];

  let goalsFor = 0;
  let goalsAgainst = 0;
  let ratingSum = 0;
  let played = 0;

  for (const d of details) {
    const info = d.matchInfo;
    if (!Array.isArray(info) || info.length === 0) continue;
    const mine = info.find((e) => e.ouid === ouid) ?? info[0];
    const opp = info.find((e) => e !== mine) ?? null;

    played += 1;
    const myGoals = goalsOf(mine);
    const oppGoals = opp ? goalsOf(opp) : 0;
    goalsFor += myGoals;
    goalsAgainst += oppGoals;
    ratingSum += mine.matchDetail?.averageRating ?? 0;

    // 폼 타임라인
    const summary = summarizeMatch(d, ouid);
    if (summary) {
      form.push({
        diff: myGoals - oppGoals,
        result: summary.result,
        label: `${myGoals}:${oppGoals} ${summary.result === '?' ? '' : summary.result}${
          summary.opponent ? ` vs ${summary.opponent.nickname}` : ''
        }`.trim(),
      });
      const t = Date.parse(d.matchDate.endsWith('Z') || d.matchDate.includes('+') ? d.matchDate : `${d.matchDate}Z`);
      if (!Number.isNaN(t)) dated.push({ time: t, result: summary.result });
    }

    // 시간대별 득실 — 각 경기별로 골 코드 판별 후 골 이벤트 시간 버킷팅
    const goalCode = detectGoalCode([
      { shots: mine.shootDetail ?? [], goals: myGoals },
      ...(opp ? [{ shots: opp.shootDetail ?? [], goals: oppGoals }] : []),
    ]);
    if (goalCode !== null) {
      for (const s of mine.shootDetail ?? [])
        if (s.result === goalCode) bands[bandIndex(s.goalTime)].forGoals += 1;
      if (opp)
        for (const s of opp.shootDetail ?? [])
          if (s.result === goalCode) bands[bandIndex(s.goalTime)].againstGoals += 1;
    }

    // 슛 타입 결정력 (내 기록)
    const shoot = mine.shoot;
    if (shoot) {
      for (const t of SHOT_TYPES) {
        const agg = shotAgg.get(t.key)!;
        agg.tries += (shoot[t.try] as number) ?? 0;
        agg.goals += (shoot[t.goal] as number) ?? 0;
      }
    }
  }

  const shotTypes: ShotTypeStat[] = SHOT_TYPES.map((t) => ({
    key: t.key,
    label: t.label,
    tries: shotAgg.get(t.key)!.tries,
    goals: shotAgg.get(t.key)!.goals,
  })).filter((s) => s.tries > 0);

  const weekly = computeWeekly(dated);

  return {
    weekly,
    played,
    goalsFor,
    goalsAgainst,
    avgRating: played ? ratingSum / played : 0,
    timeBands: bands,
    shotTypes,
    form,
  };
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** 최근 7일 vs 직전 7일 승률 비교 — 기준 시각은 데이터의 최신 경기(now 비의존, 재현성↑). */
export function computeWeekly(
  dated: { time: number; result: '승' | '무' | '패' | '?' }[]
): WeeklyForm | null {
  if (dated.length === 0) return null;
  const latest = Math.max(...dated.map((d) => d.time));
  const recent = dated.filter((d) => d.time > latest - WEEK_MS);
  const prev = dated.filter((d) => d.time <= latest - WEEK_MS && d.time > latest - 2 * WEEK_MS);
  if (recent.length === 0) return null;

  const winRate = (arr: typeof dated) => {
    const w = arr.filter((d) => d.result === '승').length;
    return Math.round((w / arr.length) * 100);
  };
  const recentWin = recent.filter((d) => d.result === '승').length;
  const recentWinRate = winRate(recent);
  const prevWinRate = prev.length > 0 ? winRate(prev) : null;
  return {
    recentGames: recent.length,
    recentWin,
    recentWinRate,
    prevGames: prev.length,
    prevWinRate,
    deltaWinRate: prevWinRate === null ? null : recentWinRate - prevWinRate,
  };
}

export interface Insight {
  tone: 'good' | 'warn' | 'info';
  text: string;
}

/** 숫자를 처방형 문장으로 — 트리거 임계 미달이면 문장을 만들지 않는다(빈 조언 금지). */
export function reportInsights(r: MatchReport): Insight[] {
  const out: Insight[] = [];
  const gf = r.goalsFor;
  const ga = r.goalsAgainst;

  const lateConceded = r.timeBands[5].againstGoals; // 76-90+
  const earlyConceded = r.timeBands[0].againstGoals; // 0-15
  const secondHalfFor =
    r.timeBands[3].forGoals + r.timeBands[4].forGoals + r.timeBands[5].forGoals;

  if (ga >= 5 && lateConceded / ga >= 0.35)
    out.push({
      tone: 'warn',
      text: `후반 막판(76분+) 실점이 전체의 ${Math.round(
        (lateConceded / ga) * 100
      )}% — 체력·집중력 이슈. 리드 시 수비형 교체·볼키핑으로 마감하세요.`,
    });
  else if (ga >= 5 && earlyConceded / ga >= 0.3)
    out.push({
      tone: 'warn',
      text: `경기 초반 15분 실점이 ${Math.round(
        (earlyConceded / ga) * 100
      )}% — 킥오프 집중력/초반 세팅 문제. 초반 안정 지향 전술을 권장해요.`,
    });

  if (gf >= 5 && secondHalfFor / gf >= 0.55)
    out.push({
      tone: 'good',
      text: `득점의 ${Math.round(
        (secondHalfFor / gf) * 100
      )}%가 후반 — 체력 우위로 뒷심이 강한 스타일이에요.`,
    });

  // 슛 타입 결정력
  const head = r.shotTypes.find((s) => s.key === 'heading');
  if (head && head.tries >= 8 && head.goals / head.tries < 0.15)
    out.push({
      tone: 'warn',
      text: `헤딩 결정력 ${Math.round(
        (head.goals / head.tries) * 100
      )}%로 낮아요 — 세트피스·크로스 손해. 제공권/위치선정 카드를 점검하세요.`,
    });

  const inbox = r.shotTypes.find((s) => s.key === 'inbox');
  const outbox = r.shotTypes.find((s) => s.key === 'outbox');
  const totalShots = r.shotTypes.reduce((a, s) => a + s.tries, 0);
  if (
    outbox &&
    totalShots > 0 &&
    outbox.tries / totalShots >= 0.4 &&
    outbox.goals / outbox.tries < 0.06
  )
    out.push({
      tone: 'warn',
      text: `박스 밖 슛이 전체의 ${Math.round(
        (outbox.tries / totalShots) * 100
      )}%인데 성공률 ${Math.round(
        (outbox.goals / outbox.tries) * 100
      )}% — 무리한 중거리 다작. 박스 진입 후 슛으로 전환하세요.`,
    });
  else if (inbox && inbox.tries >= 15 && inbox.goals / inbox.tries >= 0.25)
    out.push({
      tone: 'good',
      text: `박스 안 결정력 ${Math.round(
        (inbox.goals / inbox.tries) * 100
      )}% — 위치선정·마무리가 최상급이에요(포처 강점).`,
    });

  // 폼 스트릭 (form은 최신순)
  const streak = currentStreak(r.form);
  if (streak.count >= 3) {
    if (streak.result === '패')
      out.push({
        tone: 'warn',
        text: `최근 ${streak.count}연패 — 스쿼드·전술을 손볼 시점이에요.`,
      });
    else if (streak.result === '승')
      out.push({
        tone: 'good',
        text: `${streak.count}연승, 폼이 절정이에요 — 지금이 등급 도전 각!`,
      });
  }

  const blowouts = r.form.filter((g) => g.diff <= -3).length;
  if (blowouts >= 2)
    out.push({
      tone: 'info',
      text: `3점차 이상 대패가 ${blowouts}경기 — 특정 매치업에서 구조가 무너져요. 추격/리드 상황 전술을 분리해 보세요.`,
    });

  return out;
}

function currentStreak(form: FormGame[]): { result: '승' | '무' | '패' | '?'; count: number } {
  if (form.length === 0) return { result: '?', count: 0 };
  const first = form[0].result;
  let count = 0;
  for (const g of form) {
    if (g.result === first) count += 1;
    else break;
  }
  return { result: first, count };
}
