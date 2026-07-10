/**
 * Verdict 엔진 — 룰베이스 심판 코어 (회의 결정 아이디어 #1).
 * 숫자를 {티어 + 밈등급 + 한줄판정 + 색 + 아이콘}으로 판정해 전 화면에서 재사용.
 * AI 호출 없음(비용·지연 0). 밈 어휘는 config로 분리해 교체 가능.
 *
 * subjectType 3단 래더로 톤 게이트:
 *  - self / player: hype~roast 전체 허용 (내 기록·게임 카드 놀리기는 OK)
 *  - otherUser: roast 금지 → 중립/호의 톤으로 클램프 (실유저 저격 차단)
 */

export type SubjectType = 'self' | 'player' | 'otherUser';

export type Tier =
  | 'GOAT'
  | 'WORLDCLASS'
  | 'SOLID'
  | 'ROTATION'
  | 'BENCH'
  | 'LIABILITY';

export type VerdictColor = 'gold' | 'lime' | 'ink' | 'muted' | 'lose';

export interface Verdict {
  tier: Tier;
  label: string; // 티어 한글 라벨
  grade: string; // 스탬프에 찍히는 밈 등급 한 단어
  oneLiner: string; // 한 줄 판정
  color: VerdictColor;
  icon: string; // 형태 이중 인코딩(색맹 대응)
  score: number; // 0~100 정규화 (게이지/발광 강도용)
}

interface TierConfig {
  minRating: number;
  label: string;
  color: VerdictColor;
  icon: string;
  // 톤별 밈 어휘. otherUser는 roast를 쓰지 않음.
  grade: { pos: string[]; neutral: string[] };
  liner: { pos: string[]; neutral: string[]; roast: string[] };
}

// FC온라인 평점 밴드 기준 (5.5~8.5 실측 분포). 밈 어휘는 청소년 눈높이·비하 없이.
const TIERS: Record<Tier, TierConfig> = {
  GOAT: {
    minRating: 8.0,
    label: '갓',
    color: 'gold',
    icon: '★',
    grade: { pos: ['갓', '폼 미쳤다', '캐리'], neutral: ['최상위', '에이스'] },
    liner: {
      pos: ['혼자 다 했다', '이 폼 실화냐', '경기를 지배함'],
      neutral: ['압도적인 활약', '팀 최고 평점'],
      roast: ['원맨쇼였다'],
    },
  },
  WORLDCLASS: {
    minRating: 7.3,
    label: '월클',
    color: 'lime',
    icon: '◆',
    grade: { pos: ['월클', '밥값 이상', '핵심'], neutral: ['월드클래스', '주전'] },
    liner: {
      pos: ['제값 이상 했다', '믿고 쓰는 카드', '꾸준히 잘함'],
      neutral: ['안정적인 주전감', '기대만큼 해줌'],
      roast: ['제값은 했다'],
    },
  },
  SOLID: {
    minRating: 6.8,
    label: '일꾼',
    color: 'ink',
    icon: '●',
    grade: { pos: ['일꾼', '밥값'], neutral: ['준수', '무난'] },
    liner: {
      pos: ['묵묵히 밥값 함', '평타는 친다'],
      neutral: ['무난한 활약', '나쁘지 않음'],
      roast: ['딱 평타'],
    },
  },
  ROTATION: {
    minRating: 6.3,
    label: '로테',
    color: 'muted',
    icon: '◐',
    // neutral 풀은 otherUser(실유저)만 도달 → 비판 없이 사실·호의 톤만
    grade: { pos: ['로테감'], neutral: ['로테이션', '준주전'] },
    liner: {
      pos: ['기복은 있지만 쓸만'],
      neutral: ['꾸준함이 붙으면 주전감', '로테이션 자원'],
      roast: ['오늘은 좀 아쉬웠다'],
    },
  },
  BENCH: {
    minRating: 5.8,
    label: '벤치',
    color: 'muted',
    icon: '◔',
    grade: { pos: ['성장중'], neutral: ['성장 단계', '백업'] },
    liner: {
      pos: ['아직 적응 중'],
      neutral: ['출전 시간이 쌓이면 달라질 선수', '백업 자원'],
      roast: ['벤치가 편해 보인다'],
    },
  },
  LIABILITY: {
    minRating: 0,
    label: '반등',
    color: 'lose',
    icon: '▽',
    grade: { pos: ['반등 필요'], neutral: ['성장중', '반등 대기'] },
    liner: {
      pos: ['반등이 필요한 시점'],
      neutral: ['컨디션을 찾는 중', '기록이 쌓이면 달라질 선수'],
      roast: ['이번 판 구멍이었다'],
    },
  },
};

const TIER_ORDER: Tier[] = [
  'GOAT',
  'WORLDCLASS',
  'SOLID',
  'ROTATION',
  'BENCH',
  'LIABILITY',
];

function tierFromRating(rating: number): Tier {
  for (const t of TIER_ORDER) {
    if (rating >= TIERS[t].minRating) return t;
  }
  return 'LIABILITY';
}

/** 평점 → 0~100 (5.0 이하 0, 8.5 이상 100). 게이지·발광 강도용. */
function ratingToScore(rating: number): number {
  return Math.round(Math.min(100, Math.max(0, ((rating - 5.0) / 3.5) * 100)));
}

// 안정적 변형 선택 — 같은 대상엔 항상 같은 문구(공유·캐시 일관성). Math.random 미사용.
function pick<T>(arr: T[], seed: number, fallback: T): T {
  if (arr.length === 0) return fallback;
  return arr[Math.abs(seed) % arr.length];
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export interface VerdictInput {
  rating: number;
  subjectType: SubjectType;
  /** 문구 안정화 시드 (spId, matchId 등). 없으면 rating 기반. */
  seed?: string | number;
  /** 랭커 대비 갭(내-랭커). 양수면 톤 상향, 음수 크면 하향. */
  rankerGap?: number;
}

/** 코어: 평점 기반 심판. 전 화면이 이걸 통해 verdict를 얻는다. */
export function verdictFromRating(input: VerdictInput): Verdict {
  const { rating, subjectType, seed, rankerGap } = input;
  const tier = tierFromRating(rating);
  const cfg = TIERS[tier];
  const seedNum =
    typeof seed === 'number'
      ? seed
      : seed
        ? hashSeed(seed)
        : Math.round(rating * 100);

  // 톤 결정: 상위 티어 = 긍정, 하위 = roast(허용 시). otherUser는 roast 금지.
  const isHigh = tier === 'GOAT' || tier === 'WORLDCLASS' || tier === 'SOLID';
  const canRoast = subjectType !== 'otherUser';
  let toneKey: 'pos' | 'neutral' | 'roast';
  if (isHigh) toneKey = 'pos';
  else if (canRoast) toneKey = 'roast';
  else toneKey = 'neutral';

  // 랭커 갭 보정: 크게 밑돌면 한 톤 낮게(roast 가능 시)
  if (typeof rankerGap === 'number' && rankerGap <= -0.5 && canRoast && isHigh) {
    toneKey = 'neutral';
  }

  const gradePool = toneKey === 'pos' ? cfg.grade.pos : cfg.grade.neutral;
  const grade = pick(gradePool, seedNum, cfg.label);
  const oneLiner = pick(cfg.liner[toneKey], seedNum, cfg.label);

  return {
    tier,
    label: cfg.label,
    grade,
    oneLiner,
    color: cfg.color,
    icon: cfg.icon,
    score: ratingToScore(rating),
  };
}

/**
 * 경기 결과 심판 — 결과를 색 + 형태(아이콘) 이중 인코딩으로.
 * 승 ▲ 라임 / 무 = 중립 / 패 ▼ 빨강. 승/무/패가 티어와 무관하게 항상 구분됨.
 * 경기력 한줄은 중립/호의 톤만 (매치 리포트는 실유저 대상이라 비판 금지).
 */
export function verdictFromMatch(input: {
  result: '승' | '무' | '패' | string;
  myRating: number;
  seed?: string | number; // API 대칭용(문구 고정 불필요)
}): Verdict {
  const won = input.result === '승';
  const lost = input.result === '패';

  const color: VerdictColor = won ? 'lime' : lost ? 'lose' : 'muted';
  const icon = won ? '▲' : lost ? '▼' : '=';
  const label = won ? '승리' : lost ? '패배' : '무승부';

  const r = input.myRating;
  const perf =
    r >= 7.3
      ? '완벽한 경기력'
      : r >= 6.8
        ? '안정적인 경기'
        : r >= 6.3
          ? '무난한 경기'
          : r > 0
            ? '고전한 경기'
            : '기록 집계 안 됨';

  return {
    tier: tierFromRating(r),
    label,
    grade: label,
    oneLiner: perf,
    color,
    icon,
    score: ratingToScore(r),
  };
}

export const VERDICT_COLOR_CLASS: Record<VerdictColor, string> = {
  gold: 'text-gold',
  lime: 'text-accent',
  ink: 'text-ink',
  muted: 'text-muted',
  lose: 'text-lose',
};

export const VERDICT_BG_CLASS: Record<VerdictColor, string> = {
  gold: 'bg-gold/15 text-gold',
  lime: 'bg-accent/15 text-accent',
  ink: 'bg-surface-2 text-ink',
  muted: 'bg-surface-2 text-muted',
  lose: 'bg-lose/15 text-lose',
};
