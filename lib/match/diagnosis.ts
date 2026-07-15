import type { MatchSummary } from "../nexon/summary";
import type { RuleTone } from "../market/diagnosis";

/**
 * 공식경기 성향 룰베이스 진단.
 * 최근 경기 요약(MatchSummary, 최신순)에서 지표를 뽑아
 * 사전 셋팅된 결과 100+개(MATCH_RULES) 중 해당되는 것을 보여준다.
 * - kind "type": 플레이 유형 배지 — 우선순위(배열 순서)대로 첫 매칭 1개
 * - kind "note": 세부 코멘트 — 매칭 순서대로 최대 4개
 */

export interface MatchPerfStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  winRate: number; // 0~100
  goalsFor: number;
  goalsAgainst: number;
  avgFor: number;
  avgAgainst: number;
  /** 무실점 경기 수 */
  cleanSheets: number;
  /** 무득점 경기 수 */
  scoreless: number;
  /** 3골차 이상 승/패 */
  bigWins: number;
  bigLosses: number;
  /** 1골차 승/패 */
  closeWins: number;
  closeLosses: number;
  /** 현재 연속 기록 (+연승 / -연패, 무승부에서 끊김) */
  currentStreak: number;
  bestWinStreak: number;
  worstLoseStreak: number;
  avgRating: number;
  /** 평점 8.0 이상 / 6.0 미만(0 제외) 경기 수 */
  highRatings: number;
  lowRatings: number;
  avgPossession: number;
  /** 점유율 45% 미만 승리 (역습) */
  counterWins: number;
  /** 점유율 55% 초과 패배 (점유하고도 짐) */
  dominantLosses: number;
  forfeits: number;
  maxGoals: number;
  maxConceded: number;
  /** 양팀 모두 득점한 경기 수 */
  bothScored: number;
  /** 최근 10경기 승률 − 전체 승률 (%p, 표본 15경기 이상일 때만 의미) */
  momentum: number;
}

export function computeMatchPerfStats(summaries: MatchSummary[]): MatchPerfStats {
  // 결과를 알 수 없는 경기는 제외 (최신순 유지)
  const ms = summaries.filter((m) => m.result === "승" || m.result === "무" || m.result === "패");
  const played = ms.length;
  let win = 0, draw = 0, lose = 0;
  let goalsFor = 0, goalsAgainst = 0;
  let cleanSheets = 0, scoreless = 0;
  let bigWins = 0, bigLosses = 0, closeWins = 0, closeLosses = 0;
  let ratingSum = 0, ratingN = 0, highRatings = 0, lowRatings = 0;
  let possSum = 0, possN = 0, counterWins = 0, dominantLosses = 0;
  let forfeits = 0, maxGoals = 0, maxConceded = 0, bothScored = 0;

  for (const m of ms) {
    const gf = m.me.goals;
    const ga = m.opponent?.goals ?? 0;
    const diff = gf - ga;
    if (m.result === "승") win++;
    else if (m.result === "무") draw++;
    else lose++;
    goalsFor += gf;
    goalsAgainst += ga;
    if (ga === 0) cleanSheets++;
    if (gf === 0) scoreless++;
    if (m.result === "승" && diff >= 3) bigWins++;
    if (m.result === "패" && diff <= -3) bigLosses++;
    if (m.result === "승" && diff === 1) closeWins++;
    if (m.result === "패" && diff === -1) closeLosses++;
    if (m.me.rating > 0) {
      ratingSum += m.me.rating;
      ratingN++;
      if (m.me.rating >= 8) highRatings++;
      if (m.me.rating < 6) lowRatings++;
    }
    if (m.me.possession > 0) {
      possSum += m.me.possession;
      possN++;
      if (m.result === "승" && m.me.possession < 45) counterWins++;
      if (m.result === "패" && m.me.possession > 55) dominantLosses++;
    }
    if (m.forfeit) forfeits++;
    if (gf > maxGoals) maxGoals = gf;
    if (ga > maxConceded) maxConceded = ga;
    if (gf > 0 && ga > 0) bothScored++;
  }

  // 연속 기록 (최신 → 과거)
  let currentStreak = 0;
  for (const m of ms) {
    if (m.result === "승" && currentStreak >= 0) currentStreak++;
    else if (m.result === "패" && currentStreak <= 0) currentStreak--;
    else break;
  }
  let bestWinStreak = 0, worstLoseStreak = 0, run = 0;
  let prev: string | null = null;
  for (const m of ms) {
    if (m.result === prev && (m.result === "승" || m.result === "패")) run++;
    else run = m.result === "승" || m.result === "패" ? 1 : 0;
    prev = m.result;
    if (m.result === "승" && run > bestWinStreak) bestWinStreak = run;
    if (m.result === "패" && run > worstLoseStreak) worstLoseStreak = run;
  }

  const winRate = played ? Math.round((win / played) * 100) : 0;
  const recent10 = ms.slice(0, 10);
  const r10win = recent10.filter((m) => m.result === "승").length;
  const momentum =
    played >= 15 && recent10.length === 10
      ? Math.round((r10win / 10) * 100) - winRate
      : 0;

  return {
    played, win, draw, lose, winRate,
    goalsFor, goalsAgainst,
    avgFor: played ? goalsFor / played : 0,
    avgAgainst: played ? goalsAgainst / played : 0,
    cleanSheets, scoreless, bigWins, bigLosses, closeWins, closeLosses,
    currentStreak, bestWinStreak, worstLoseStreak,
    avgRating: ratingN ? ratingSum / ratingN : 0,
    highRatings, lowRatings,
    avgPossession: possN ? Math.round(possSum / possN) : 0,
    counterWins, dominantLosses, forfeits, maxGoals, maxConceded, bothScored,
    momentum,
  };
}

export interface MatchRule {
  id: string;
  kind: "type" | "note";
  tone: RuleTone;
  title: string;
  desc: string;
  when: (s: MatchPerfStats) => boolean;
}

const R = (
  id: string,
  kind: "type" | "note",
  tone: RuleTone,
  title: string,
  desc: string,
  when: (s: MatchPerfStats) => boolean
): MatchRule => ({ id, kind, tone, title, desc, when });

export const MATCH_RULES: MatchRule[] = [
  // ═══════════ 플레이 유형 (우선순위 순 — 첫 매칭 1개) ═══════════
  R("t-champ", "type", "gold", "폼 미쳤다", "승률 70% 이상에 5연승 이상 진행 중 — 지금 당신을 막을 사람이 없습니다.", (s) => s.played >= 10 && s.winRate >= 70 && s.currentStreak >= 5),
  R("t-wall", "type", "win", "철벽 수비", "경기당 실점 1 미만 + 무실점 경기 다수 — 수비가 팀의 정체성입니다.", (s) => s.played >= 10 && s.avgAgainst < 1 && s.cleanSheets >= s.played * 0.4),
  R("t-cannon", "type", "gold", "화력 덕후", "경기당 3골 이상 — 일단 상대보다 한 골 더 넣으면 됩니다.", (s) => s.played >= 10 && s.avgFor >= 3),
  R("t-counter", "type", "win", "역습의 명수", "점유율을 내주고도 이깁니다 — 한 방 카운터가 주무기.", (s) => s.played >= 10 && s.counterWins >= 3 && s.winRate >= 50),
  R("t-clutch", "type", "win", "클러치 승부사", "1골차 승리가 유독 많습니다 — 접전에서 강한 심장.", (s) => s.played >= 10 && s.closeWins >= s.win * 0.5 && s.win >= 5),
  R("t-dominator", "type", "info", "점유율 신봉자", "평균 점유율 55% 이상 — 공을 소유해야 마음이 편한 타입.", (s) => s.played >= 10 && s.avgPossession >= 55),
  R("t-rollercoaster", "type", "info", "롤러코스터", "대승과 대패가 공존 — 이기는 날은 화끈하게, 지는 날도 화끈하게.", (s) => s.bigWins >= 3 && s.bigLosses >= 3),
  R("t-hotstreak", "type", "win", "상승 기류", "최근 10경기 승률이 전체보다 20%p 이상 높습니다 — 폼이 올라오는 중.", (s) => s.momentum >= 20),
  R("t-slump", "type", "lose", "일시적 슬럼프", "최근 10경기 승률이 전체보다 20%p 이상 낮습니다 — 한 템포 쉬어가도 좋아요.", (s) => s.momentum <= -20),
  R("t-solid", "type", "win", "안정적 강자", "승률 60% 이상을 꾸준히 — 기복 없는 강함이 최고의 무기.", (s) => s.played >= 10 && s.winRate >= 60),
  R("t-drawmaster", "type", "info", "무승부 수집가", "무승부 비중이 25% 이상 — 승부를 못 가리는 팽팽한 경기력.", (s) => s.played >= 10 && s.draw >= s.played * 0.25),
  R("t-rebuilding", "type", "lose", "리빌딩 시즌", "승률 35% 미만 — 지금은 팀을 만드는 시간입니다.", (s) => s.played >= 10 && s.winRate < 35),
  R("t-newface", "type", "info", "기록 수집 중", "표본이 아직 적습니다 — 몇 경기 더 쌓이면 정확한 유형이 나와요.", (s) => s.played < 10),
  R("t-allrounder", "type", "info", "균형형 플레이어", "공수 지표가 고르게 분포 — 상황에 맞춰 색깔을 바꿉니다.", () => true),

  // ═══════════ 승률 (note) ═══════════
  R("n-wr-90", "note", "gold", "승률 90%+", "이 구간은 프로 스카우트가 봐야 할 수준입니다.", (s) => s.played >= 10 && s.winRate >= 90),
  R("n-wr-80", "note", "gold", "승률 80%대", "열에 여덟은 이깁니다 — 상대 입장에선 재앙.", (s) => s.played >= 10 && s.winRate >= 80 && s.winRate < 90),
  R("n-wr-70", "note", "win", "승률 70%대", "안정적인 강자 구간 — 랭크가 곧 오릅니다.", (s) => s.played >= 10 && s.winRate >= 70 && s.winRate < 80),
  R("n-wr-60", "note", "win", "승률 60%대", "확실한 승자 체질 — 이기는 법을 압니다.", (s) => s.played >= 10 && s.winRate >= 60 && s.winRate < 70),
  R("n-wr-50", "note", "info", "승률 50%대", "딱 절반의 세계 — 한 끗이 승패를 가릅니다.", (s) => s.played >= 10 && s.winRate >= 50 && s.winRate < 60),
  R("n-wr-40", "note", "info", "승률 40%대", "조금만 다듬으면 5할 돌파 — 패배 원인 분석이 답.", (s) => s.played >= 10 && s.winRate >= 40 && s.winRate < 50),
  R("n-wr-low", "note", "lose", "승률 40% 미만", "힘든 구간이지만 데이터가 약점을 알려줍니다 — 분석 탭을 확인하세요.", (s) => s.played >= 10 && s.winRate < 40),

  // ═══════════ 연속 기록 (note) ═══════════
  R("n-streak-w7", "note", "gold", "7연승+", "현재 7연승 이상 — 오늘 멈출 이유가 없습니다.", (s) => s.currentStreak >= 7),
  R("n-streak-w4", "note", "win", "4연승 이상", "연승 열차 운행 중 — 이 기세를 즐기세요.", (s) => s.currentStreak >= 4 && s.currentStreak < 7),
  R("n-streak-w2", "note", "win", "연승 중", "2~3연승 진행 중 — 좋은 흐름입니다.", (s) => s.currentStreak >= 2 && s.currentStreak < 4),
  R("n-streak-l2", "note", "lose", "연패 중", "2~3연패 — 다음 한 경기가 분위기를 바꿉니다.", (s) => s.currentStreak <= -2 && s.currentStreak > -4),
  R("n-streak-l4", "note", "lose", "4연패 이상", "연패 늪 — 포메이션이나 스쿼드에 변화를 줄 타이밍.", (s) => s.currentStreak <= -4),
  R("n-best-w5", "note", "win", "최다 5연승+", "표본 내 최대 연승이 5 이상 — 폭발력이 있습니다.", (s) => s.bestWinStreak >= 5 && s.currentStreak < 5),
  R("n-worst-l5", "note", "lose", "5연패 경험", "표본 내 5연패 구간 존재 — 무너질 때 빨리 끊는 게 과제.", (s) => s.worstLoseStreak >= 5),

  // ═══════════ 득점력 (note) ═══════════
  R("n-gf-4", "note", "gold", "경기당 4골+", "폭격기 수준의 화력 — 상대 골키퍼에게 묵념.", (s) => s.played >= 5 && s.avgFor >= 4),
  R("n-gf-3", "note", "win", "경기당 3골대", "꾸준한 다득점 — 공격 루트가 다양하다는 뜻.", (s) => s.played >= 5 && s.avgFor >= 3 && s.avgFor < 4),
  R("n-gf-2", "note", "info", "경기당 2골대", "평균 이상의 득점력 — 해결사가 있군요.", (s) => s.played >= 5 && s.avgFor >= 2 && s.avgFor < 3),
  R("n-gf-1", "note", "info", "경기당 1골대", "득점이 아쉬운 날이 있습니다 — 마무리 정확도가 관건.", (s) => s.played >= 5 && s.avgFor >= 1 && s.avgFor < 2),
  R("n-gf-low", "note", "lose", "경기당 1골 미만", "창끝이 무딥니다 — 공격 전개 패턴 점검이 필요해요.", (s) => s.played >= 5 && s.avgFor < 1),
  R("n-max-6", "note", "gold", "한 경기 6골+", "최다 득점 경기가 6골 이상 — 그날 상대는 악몽을 꿨을 겁니다.", (s) => s.maxGoals >= 6),

  // ═══════════ 수비 (note) ═══════════
  R("n-ga-low", "note", "win", "경기당 실점 1 미만", "잠그는 축구의 정석 — 수비 조직력이 훌륭합니다.", (s) => s.played >= 5 && s.avgAgainst < 1),
  R("n-ga-1", "note", "info", "경기당 실점 1점대", "평균적인 수비 — 무실점 경기를 늘리면 승률이 뜁니다.", (s) => s.played >= 5 && s.avgAgainst >= 1 && s.avgAgainst < 2),
  R("n-ga-2", "note", "lose", "경기당 실점 2점대", "뒷문이 자주 열립니다 — 수비 라인 간격을 점검하세요.", (s) => s.played >= 5 && s.avgAgainst >= 2 && s.avgAgainst < 3),
  R("n-ga-high", "note", "lose", "경기당 실점 3+", "수비 리빌딩이 시급합니다 — 실점 장면 리플레이 추천.", (s) => s.played >= 5 && s.avgAgainst >= 3),
  R("n-cs-many", "note", "win", "무실점 경기 40%+", "클린시트 비율이 최상위권 — 골키퍼와 수비진에 보너스를.", (s) => s.played >= 5 && s.cleanSheets >= s.played * 0.4),
  R("n-cs-some", "note", "info", "클린시트 보유", "무실점 경기가 있습니다 — 잠글 줄 아는 팀.", (s) => s.played >= 5 && s.cleanSheets >= 2 && s.cleanSheets < s.played * 0.4),
  R("n-maxcon-5", "note", "lose", "한 경기 5실점+", "대량 실점 경기가 있었습니다 — 무너진 날의 패턴을 찾아보세요.", (s) => s.maxConceded >= 5),

  // ═══════════ 경기 양상 (note) ═══════════
  R("n-big-wins", "note", "gold", "대승 제조기", "3골차 이상 승리가 다수 — 이길 때 확실히 밟습니다.", (s) => s.bigWins >= 4),
  R("n-big-losses", "note", "lose", "대패 주의보", "3골차 이상 패배가 다수 — 무너지기 시작하면 걷잡을 수 없는 타입.", (s) => s.bigLosses >= 4),
  R("n-close-wins", "note", "win", "한 골차 스페셜리스트", "1골차 승리가 많습니다 — 리드 지키기의 달인.", (s) => s.closeWins >= 4),
  R("n-close-losses", "note", "lose", "한 골이 아쉽다", "1골차 패배가 많습니다 — 딱 한 골이 모자란 경기들.", (s) => s.closeLosses >= 4),
  R("n-scoreless-many", "note", "lose", "무득점 경기 다수", "0골 경기가 잦습니다 — 공격 옵션을 늘려보세요.", (s) => s.played >= 5 && s.scoreless >= s.played * 0.3),
  R("n-bothscored", "note", "info", "화끈한 오픈 게임", "양팀 모두 득점한 경기가 대부분 — 닫아두는 법이 없군요.", (s) => s.played >= 5 && s.bothScored >= s.played * 0.7),
  R("n-draws-many", "note", "info", "무승부 다수", "비긴 경기가 많습니다 — 마지막 10분 집중력이 승점 3점을 만듭니다.", (s) => s.draw >= 4),

  // ═══════════ 평점 (note) ═══════════
  R("n-rating-high", "note", "gold", "평균 평점 7.5+", "선수단 전체가 꾸준히 활약 — 스쿼드 밸런스가 좋습니다.", (s) => s.avgRating >= 7.5),
  R("n-rating-good", "note", "win", "평균 평점 7점대", "준수한 경기력 — 에이스 의존도만 줄이면 완벽.", (s) => s.avgRating >= 7 && s.avgRating < 7.5),
  R("n-rating-mid", "note", "info", "평균 평점 6점대", "평점이 평범합니다 — 몇몇 포지션 업그레이드 여지가 있어요.", (s) => s.avgRating >= 6 && s.avgRating < 7),
  R("n-rating-low", "note", "lose", "평균 평점 6 미만", "경기 내용이 결과보다 아쉽습니다 — 스쿼드 진단을 받아보세요.", (s) => s.avgRating > 0 && s.avgRating < 6),
  R("n-rating-peak", "note", "win", "8점대 경기 다수", "평점 8.0 이상 경기가 여러 번 — 터지는 날은 확실히 터집니다.", (s) => s.highRatings >= 3),
  R("n-rating-floor", "note", "lose", "6점 미만 경기 다수", "낮은 평점 경기가 잦습니다 — 안 풀리는 날의 플랜 B가 필요해요.", (s) => s.lowRatings >= 3),

  // ═══════════ 점유율 스타일 (note) ═══════════
  R("n-poss-60", "note", "info", "평균 점유율 60%+", "티키타카 수준의 볼 소유 — 상대는 공 구경만 합니다.", (s) => s.avgPossession >= 60),
  R("n-poss-55", "note", "info", "점유율 우위", "평균 점유율 55~60% — 주도권을 쥐고 경기합니다.", (s) => s.avgPossession >= 55 && s.avgPossession < 60),
  R("n-poss-45", "note", "info", "실리 축구", "평균 점유율 45% 미만 — 공은 내주고 승점은 챙깁니다.", (s) => s.avgPossession > 0 && s.avgPossession < 45),
  R("n-counter-wins", "note", "win", "카운터 어택", "점유율 열세 승리 다수 — 역습 한 방이 제대로 걸립니다.", (s) => s.counterWins >= 3),
  R("n-dominant-losses", "note", "lose", "점유하고도 패배", "공은 많이 잡는데 지는 경기가 있습니다 — 마무리 또는 뒷공간 문제.", (s) => s.dominantLosses >= 3),

  // ═══════════ 모멘텀 (note) ═══════════
  R("n-momentum-up", "note", "win", "상승세", "최근 10경기가 전체 평균보다 좋습니다 — 지금이 달릴 때.", (s) => s.momentum >= 10 && s.momentum < 20),
  R("n-momentum-down", "note", "lose", "하락세", "최근 10경기가 전체 평균보다 처집니다 — 변화의 신호일 수 있어요.", (s) => s.momentum <= -10 && s.momentum > -20),
  R("n-momentum-stable", "note", "info", "꾸준한 페이스", "최근 폼과 전체 성적이 거의 같습니다 — 기복 없는 유형.", (s) => s.played >= 15 && Math.abs(s.momentum) < 5),

  // ═══════════ 몰수/표본 (note) ═══════════
  R("n-forfeit-some", "note", "info", "몰수 경기 포함", "표본에 몰수 경기가 섞여 있습니다 — 통계 해석에 참고하세요.", (s) => s.forfeits >= 1 && s.forfeits <= 2),
  R("n-forfeit-many", "note", "lose", "몰수 경기 다수", "몰수가 잦습니다 — 네트워크 환경이나 진행 습관 점검을 추천해요.", (s) => s.forfeits >= 3),
  R("n-sample-full", "note", "info", "표본 30경기", "최근 30경기 풀 표본 — 이 진단은 신뢰할 만합니다.", (s) => s.played >= 30),
  R("n-sample-small", "note", "info", "작은 표본", "10경기 미만 표본 — 진단은 참고용으로만 보세요.", (s) => s.played > 0 && s.played < 10),

  // ═══════════ 조합 (note) ═══════════
  R("n-combo-fortress", "note", "win", "이기면 무실점", "승리 경기 대부분이 클린시트 — 앞서면 잠급니다.", (s) => s.win >= 5 && s.cleanSheets >= s.win * 0.6),
  R("n-combo-shootout", "note", "info", "난타전 체질", "경기당 합계 4골 이상 — 보는 사람은 즐겁습니다.", (s) => s.played >= 5 && (s.goalsFor + s.goalsAgainst) / s.played >= 4),
  R("n-combo-grind", "note", "info", "저득점 승부사", "경기당 합계 2골 미만의 실리 축구 — 한 골 싸움에 강해야 합니다.", (s) => s.played >= 5 && (s.goalsFor + s.goalsAgainst) / s.played < 2),
  R("n-combo-gd-plus", "note", "win", "압도적 득실차", "총 득실차 +15 이상 — 순위표가 증명하는 강함.", (s) => s.goalsFor - s.goalsAgainst >= 15),
  R("n-combo-gd-minus", "note", "lose", "득실차 열세", "총 득실차 -10 이하 — 수비 보강이 1순위입니다.", (s) => s.goalsFor - s.goalsAgainst <= -10),
  R("n-combo-winhigh-gflow", "note", "info", "효율의 마법사", "득점은 적은데 승률은 높습니다 — 필요한 골만 넣는 효율파.", (s) => s.played >= 10 && s.winRate >= 55 && s.avgFor < 2),
  R("n-combo-gfhigh-wrlow", "note", "info", "골은 많은데…", "다득점에도 승률이 아쉽습니다 — 실점 관리가 발목을 잡네요.", (s) => s.played >= 10 && s.avgFor >= 2.5 && s.winRate < 50),
  R("n-combo-nodraw", "note", "info", "무승부 없음", "비긴 경기가 하나도 없습니다 — 끝장을 봐야 직성이 풀리는 타입.", (s) => s.played >= 10 && s.draw === 0),
  R("n-combo-balanced-gd", "note", "info", "종이 한 장 차이", "득실차가 ±3 이내 — 모든 경기가 접전이었습니다.", (s) => s.played >= 10 && Math.abs(s.goalsFor - s.goalsAgainst) <= 3),
  R("n-combo-decisive", "note", "win", "확실한 마무리", "승리의 절반 이상이 2골차 이상 — 이길 땐 여유 있게 이깁니다.", (s) => s.win >= 5 && s.win - s.closeWins >= s.win * 0.5 && s.winRate >= 50),

  // ═══════════ 기록 이정표 (note) ═══════════
  R("n-mile-unbeaten", "note", "gold", "무패 행진", "표본 내 패배가 없습니다 — 무결점 시즌 진행 중.", (s) => s.played >= 5 && s.lose === 0),
  R("n-mile-allwin", "note", "gold", "전승", "표본 전 경기 승리 — 더 말이 필요 없습니다.", (s) => s.played >= 5 && s.win === s.played),
  R("n-mile-20w", "note", "win", "20승 돌파", "표본 내 20승 이상 — 승리가 습관입니다.", (s) => s.win >= 20),
  R("n-mile-10w", "note", "win", "두 자릿수 승리", "표본 내 10승 이상 — 탄탄한 승수 적립.", (s) => s.win >= 10 && s.win < 20),
  R("n-mile-nowin", "note", "lose", "첫 승 사냥 중", "표본 내 승리가 아직 없습니다 — 첫 승이 가장 어렵죠.", (s) => s.played >= 3 && s.win === 0),
  R("n-mile-15l", "note", "lose", "패배 15+", "패배가 많이 쌓였습니다 — 지는 경기의 공통점을 찾아보세요.", (s) => s.lose >= 15),
  R("n-mile-beststreak8", "note", "gold", "8연승 기록 보유", "표본 내 최대 연승 8 이상 — 리그를 씹어먹던 구간이 있었네요.", (s) => s.bestWinStreak >= 8),
  R("n-mile-losestreak34", "note", "lose", "3~4연패 구간", "짧은 연패 구간이 있었습니다 — 회복한 게 더 중요합니다.", (s) => s.worstLoseStreak >= 3 && s.worstLoseStreak <= 4),

  // ═══════════ 표본/경기수 (note) ═══════════
  R("n-played-1019", "note", "info", "표본 10~19경기", "판정에 충분한 표본이 쌓이는 중입니다.", (s) => s.played >= 10 && s.played <= 19),
  R("n-played-2029", "note", "info", "표본 20~29경기", "표본이 넉넉해 지표 신뢰도가 높습니다.", (s) => s.played >= 20 && s.played <= 29),

  // ═══════════ 골 패턴 추가 (note) ═══════════
  R("n-goal-everygame", "note", "win", "매 경기 득점", "무득점 경기가 없습니다 — 어떤 수비든 한 번은 뚫습니다.", (s) => s.played >= 5 && s.scoreless === 0),
  R("n-goal-nocs", "note", "lose", "클린시트 제로", "무실점 경기가 없습니다 — 매 경기 한 골은 내준다는 뜻.", (s) => s.played >= 5 && s.cleanSheets === 0),
  R("n-goal-max45", "note", "info", "한 경기 4~5골", "최다 득점 경기 4~5골 — 터질 땐 확실히 터집니다.", (s) => s.maxGoals >= 4 && s.maxGoals <= 5),
  R("n-goal-avg5", "note", "gold", "경기당 5골+", "이건 축구가 아니라 농구입니다 — 압도적 공격력.", (s) => s.played >= 5 && s.avgFor >= 5),
  R("n-goal-oneside", "note", "info", "원사이드 경기 다수", "한쪽만 득점한 경기가 대부분 — 흐름을 잡은 쪽이 다 가져갑니다.", (s) => s.played >= 5 && s.bothScored <= s.played * 0.3),
  R("n-goal-maxcon34", "note", "info", "한 경기 3~4실점", "실점이 몰린 경기가 있었습니다 — 그날의 상성을 복기해보세요.", (s) => s.maxConceded >= 3 && s.maxConceded <= 4),

  // ═══════════ 스타일 조합 추가 (note) ═══════════
  R("n-style-complete", "note", "gold", "완전체 밸런스", "경기당 2.5골 이상 넣고 1.2골 미만 실점 — 공수 모두 최상위권.", (s) => s.played >= 10 && s.avgFor >= 2.5 && s.avgAgainst < 1.2),
  R("n-style-shieldnosword", "note", "info", "창보다 방패", "실점은 적은데 득점도 적습니다 — 공격에 한 명만 더 투자하면?", (s) => s.played >= 10 && s.avgAgainst < 1.2 && s.avgFor < 1.5),
  R("n-style-grindwin", "note", "info", "꾸역승 전문", "대승 없이 꾸준히 이깁니다 — 어떻게든 이기는 게 실력입니다.", (s) => s.win >= 5 && s.bigWins === 0 && s.winRate >= 50),
  R("n-style-nocollapse", "note", "win", "대패 없음", "3골차 이상으로 진 적이 없습니다 — 무너지지 않는 팀.", (s) => s.played >= 10 && s.bigLosses === 0),
  R("n-style-extreme", "note", "info", "모 아니면 도", "접전이 드물고 큰 승부가 많습니다 — 화끈한 스타일.", (s) => s.bigWins + s.bigLosses >= 5 && s.closeWins + s.closeLosses <= 2),
  R("n-style-poss5050", "note", "info", "점유율 반반", "평균 점유율 45~55% — 소유보다 효율로 승부합니다.", (s) => s.avgPossession >= 45 && s.avgPossession < 55),
  R("n-style-exact50", "note", "info", "정확히 5할", "승률이 딱 50% — 다음 경기가 방향을 정합니다.", (s) => s.played >= 10 && s.winRate === 50),
  R("n-style-cleanmanner", "note", "win", "몰수 없음", "표본 내 몰수 경기 0 — 클린한 완주 매너.", (s) => s.played >= 10 && s.forfeits === 0),
  R("n-style-drawrare", "note", "info", "가끔 무승부", "무승부 1~3회 — 승부가 대체로 갈리는 편입니다.", (s) => s.draw >= 1 && s.draw <= 3 && s.played >= 10),
] as const as MatchRule[];

export interface MatchDiagnosis {
  type: MatchRule | null;
  notes: MatchRule[];
}

const MAX_NOTES = 4;

export function diagnoseMatchPerf(s: MatchPerfStats): MatchDiagnosis {
  if (s.played === 0) return { type: null, notes: [] };
  const type = MATCH_RULES.find((r) => r.kind === "type" && r.when(s)) ?? null;
  const notes = MATCH_RULES.filter((r) => r.kind === "note" && r.when(s)).slice(0, MAX_NOTES);
  return { type, notes };
}
