/**
 * 앱이 디코딩하는 JSON 응답 계약 (파괴적 변경 감지용).
 *
 * 왜 필요한가 — iOS 앱(github.com/humsleep/fcscope)은 이 응답들을 `Models.swift` 로 그대로
 * 디코딩하며 **버전 협상이 없다**. 앱스토어에 나간 구버전은 몇 달씩 살아 있고 심사 때문에
 * 즉시 고칠 수도 없어서, 필드를 지우거나 이름·타입을 바꾸면 그 순간 배포된 앱이 깨진다.
 * Swift 의 `Decodable` 은 필수 필드가 하나만 없어도 **응답 전체 디코딩이 실패**한다.
 *
 * 이 파일은 "앱이 반드시 받아야 하는 것"의 목록이다. AGENTS.md 의 v1 계약 규칙과 한 쌍이다.
 * - 필드 추가는 자유(여기에 안 적어도 된다). 앱은 모르는 키를 무시한다.
 * - 필드 삭제·개명·타입 변경은 금지. 없앨 값은 `null` 로 계속 내려보낸다.
 * - 앱을 먼저 고쳐 출시하고, 구버전이 충분히 빠진 뒤에야 여기서 지운다.
 *
 * 검증: `npm run verify:api -- <baseUrl>` (실제 응답 대조) / `npm test` (검증기 자체 테스트).
 */

/**
 * 스펙 문법 — 값은 타입 이름, 키의 `?` 접미사는 "null 이거나 없어도 됨".
 *   'string' | 'int' | 'number' | 'bool' | 'any'   원시 타입
 *   'Rival'                                        SHAPES 에 정의된 이름
 *   'Rival[]'                                      배열 (원소는 non-null)
 * 앱이 옵셔널로 선언한 필드만 `?` 를 붙인다. 그 외에는 전부 필수다.
 */
export type Shape = Record<string, string>;

/** 응답 안에서 반복되는 구조. 키 이름은 Models.swift 의 struct 이름과 맞춘다. */
export const SHAPES: Record<string, Shape> = {
  DivisionCard: {
    matchType: 'int', matchTypeName: 'string', division: 'int',
    divisionName: 'string', date: 'string', 'iconUrl?': 'string',
  },
  UserProfile: { ouid: 'string', nickname: 'string', level: 'int', divisions: 'DivisionCard[]' },
  MatchTab: { type: 'int', label: 'string' },
  RecordSummary: {
    played: 'int', win: 'int', draw: 'int', lose: 'int', winRate: 'int',
    goalsFor: 'int', goalsAgainst: 'int', avgPossession: 'int',
  },
  ScoreTier: { label: 'string', tone: 'string' },
  StreakInfo: { text: 'string', color: 'string', icon: 'string', highlight: 'bool' },
  PerfStats: {
    played: 'int', winRate: 'int', currentStreak: 'int', bestWinStreak: 'int', momentum: 'int',
    avgRating: 'number', cleanSheets: 'int', scoreless: 'int', bigWins: 'int', bigLosses: 'int',
    counterWins: 'int', dominantLosses: 'int',
    // 2026-09-18 추가(옵셔널): 몰수 경기 수 · 몰수 제외 정상 종료 경기 수(스코어 기반 지표의 분모)
    'forfeits?': 'int', 'normalPlayed?': 'int',
  },
  Rule: { id: 'string', kind: 'string', tone: 'string', title: 'string', desc: 'string' },
  Diagnosis: { 'type?': 'Rule', notes: 'Rule[]' },
  BestMatch: { matchId: 'string', score: 'number' },
  WeeklyRecap: {
    games: 'int', win: 'int', draw: 'int', lose: 'int', winRate: 'int', bestStreak: 'int',
    goalsFor: 'int', goalsAgainst: 'int', avgScore: 'number', 'best?': 'BestMatch', 'truncated?': 'bool',
  },
  Rival: {
    nickname: 'string', win: 'int', draw: 'int', lose: 'int',
    games: 'int', goalsFor: 'int', goalsAgainst: 'int',
  },
  SummaryMe: { nickname: 'string', goals: 'int', possession: 'int', rating: 'number' },
  SummaryOpp: { nickname: 'string', goals: 'int' },
  MatchSummary: {
    matchId: 'string', matchDate: 'string', matchType: 'int', result: 'string',
    forfeit: 'bool', me: 'SummaryMe', 'opponent?': 'SummaryOpp', score: 'number',
  },
  CardLinks: { user: 'string', 'rank?': 'string', streak: 'string', weekly: 'string', 'rival?': 'string' },

  TimeBand: { label: 'string', forGoals: 'int', againstGoals: 'int' },
  ShotTypeStat: { key: 'string', label: 'string', tries: 'int', goals: 'int' },
  FormGame: { diff: 'int', result: 'string', label: 'string', 'forfeit?': 'bool' },
  WeeklyForm: {
    recentGames: 'int', recentWin: 'int', recentWinRate: 'int', prevGames: 'int',
    'prevWinRate?': 'int', 'deltaWinRate?': 'int',
  },
  MatchReport: {
    played: 'int', goalsFor: 'int', goalsAgainst: 'int', avgRating: 'number',
    timeBands: 'TimeBand[]', shotTypes: 'ShotTypeStat[]', form: 'FormGame[]', 'weekly?': 'WeeklyForm',
  },
  Insight: { tone: 'string', text: 'string' },

  Verdict: {
    tier: 'string', label: 'string', grade: 'string', oneLiner: 'string',
    color: 'string', icon: 'string', score: 'number',
  },
  ClinicLine: { line: 'string', label: 'string', count: 'int', avgRating: 'number', score: 'number' },
  ClinicPlayer: {
    spId: 'int', position: 'int', line: 'string', games: 'int',
    avgRating: 'number', goals: 'int', assists: 'int',
  },
  ClinicIssue: { kind: 'string', severity: 'string', text: 'string', 'spId?': 'int' },
  Clinic: {
    overall: 'number', band: 'string', squadRating: 'number', lines: 'ClinicLine[]',
    weakLinks: 'ClinicPlayer[]', strengths: 'ClinicPlayer[]', issues: 'ClinicIssue[]',
    rankerCoverage: 'number', players: 'int', sampleGames: 'int',
  },
  PicksInfo: { 'date?': 'string', topPickCount: 'int', total: 'int', cardUrl: 'string' },
  RankerCompare: { goal: 'number', passRate: 'int', matchCount: 'int' },
  PlayerCard: {
    spId: 'int', mainPosition: 'int', games: 'int', avgRating: 'number', goals: 'int', assists: 'int',
    goalsPerGame: 'number', assistsPerGame: 'number', passRate: 'number', name: 'string',
    season: 'string', positionLabel: 'string', imageUrl: 'string', verdict: 'Verdict',
    'ranker?': 'RankerCompare', topPick: 'bool',
  },

  Archetype: { id: 'string', name: 'string', tagline: 'string', baseStrength: 'string', baseWeakness: 'string' },
  Axis: {
    key: 'string', label: 'string', value: 'number', bipolar: 'bool',
    'leftLabel?': 'string', 'rightLabel?': 'string', lowConf: 'bool',
  },
  StyleChip: { text: 'string', kind: 'string' },
  PlaystyleResult: {
    confidence: 'string', games: 'int', controller: 'string',
    archetype: 'Archetype', axes: 'Axis[]', chips: 'StyleChip[]',
  },
  // minute·player·inPenalty 는 앱에서 옵셔널(기본값 nil)이라 없어도 된다.
  Shot: { x: 'number', y: 'number', isGoal: 'bool', hitPost: 'bool' },

  SideStats: {
    shots: 'int', effectiveShots: 'int', passTry: 'int', passSuccess: 'int', 'passRate?': 'int',
    dribble: 'int', tackleTry: 'int', tackleSuccess: 'int', cornerKick: 'int',
    foul: 'int', yellowCards: 'int', redCards: 'int', offside: 'int',
  },
  MatchPlayerRow: {
    spId: 'int', name: 'string', position: 'int', positionLabel: 'string',
    rating: 'number', goals: 'int', assists: 'int', imageUrl: 'string',
  },
  MatchSide: {
    ouid: 'string', nickname: 'string', result: 'string', forfeit: 'bool', goals: 'int',
    possession: 'int', rating: 'number', controller: 'string', stats: 'SideStats',
    shots: 'Shot[]', players: 'MatchPlayerRow[]',
  },
  Potm: { spId: 'int', name: 'string', positionLabel: 'string', side: 'string', rating: 'number', imageUrl: 'string' },

  // delta 는 Int?? — 키가 있고 값이 null 이면 "신규 진입"을 뜻한다. 키 자체를 없애면 안 된다.
  Mover: {
    spId: 'int', position: 'int', line: 'string', matchCount: 'int', 'delta?': 'int', 'usage?': 'int',
    name: 'string', season: 'string', positionLabel: 'string', imageUrl: 'string', 'lineTitle?': 'string',
  },
  PickRow: {
    spId: 'int', position: 'int', matchCount: 'int', goalsPerMatch: 'number', passPct: 'number',
    'delta?': 'int', 'usage?': 'int', name: 'string', season: 'string', positionLabel: 'string', imageUrl: 'string',
  },
  MetaLine: { line: 'string', title: 'string', rows: 'PickRow[]' },

  SeasonVariant: { spid: 'int', season: 'string' },
  Playstyle: { label: 'string', emoji: 'string', tone: 'string' },
  PositionStat: {
    position: 'int', matchCount: 'int', goal: 'number', assist: 'number', shoot: 'number',
    effectiveShoot: 'number', passSuccess: 'number', passTry: 'number', dribbleSuccess: 'number',
    dribbleTry: 'number', tackle: 'number', block: 'number', positionLabel: 'string',
    'passRate?': 'int', 'dribbleRate?': 'int', 'playstyle?': 'Playstyle',
  },
  RankerMeta: { 'date?': 'string', totalMatches: 'int', positions: 'PositionStat[]' },

  YtVideo: { id: 'string', title: 'string', channel: 'string', url: 'string', thumb: 'string' },
  HomePost: { id: 'string', type: 'string', title: 'string', created_at: 'string', 'comment_count?': 'int' },

  PostTypeInfo: {
    type: 'string', label: 'string', emoji: 'string', blurb: 'string', accent: 'string',
    fields: 'string[]', template: 'string', bodyLabel: 'string', bodyPlaceholder: 'string',
  },
  PostAuthor: { id: 'string', nickname: 'string', 'verifiedNickname?': 'string' },
  MetaRow: { key: 'string', label: 'string', value: 'string' },
  Post: {
    id: 'string', author_id: 'string', type: 'string', title: 'string', body: 'string',
    'region?': 'string', positions: 'string[]', 'contact?': 'string', 'squad_id?': 'string',
    meta: 'any', status: 'string', created_at: 'string', 'comment_count?': 'int',
    author: 'PostAuthor', typeLabel: 'string', typeEmoji: 'string',
    'preview?': 'string', 'metaRows?': 'MetaRow[]', 'squadB?': 'string',
  },
  CommentAuthor: { id: 'string', nickname: 'string' },
  Comment: {
    id: 'string', post_id: 'string', author_id: 'string', body: 'string',
    'squad_id?': 'string', created_at: 'string', author: 'CommentAuthor', isOwn: 'bool',
  },
  Viewer: { loggedIn: 'bool', isOwner: 'bool', canComment: 'bool' },

  SquadSlot: { slotId: 'string', spid: 'int', name: 'string', 'season?': 'string', 'x?': 'number', 'y?': 'number', 'imageSpid?': 'int', 'pos?': 'string' },
  PlayerHit: { spid: 'int', pid: 'int', name: 'string', season: 'string', seasons: 'SeasonVariant[]' },

  // ── 구 라우트(/api/*) — 앱이 v1 과 똑같이 의존한다. 웹도 함께 쓰므로 오히려 리팩터링에 휩쓸리기 쉽다.
  MyProfile: { 'id?': 'string', 'nickname?': 'string', 'verified_nickname?': 'string', 'verified_ouid?': 'string' },
  MyPost: { id: 'string', type: 'string', title: 'string', created_at: 'string' },
  MySquad: { id: 'string', name: 'string', formation: 'string' },
  Snapshot: {
    winRate: 'int', avgRating: 'number', played: 'int',
    'deltaWinRate?': 'int', 'deltaRating?': 'number', 'prevDate?': 'string',
  },
  FormPoint: { date: 'string', winRate: 'int', avgRating: 'number' },
  NotifItem: { postId: 'string', title: 'string', count: 'int' },
  ImportedPlayer: { spid: 'int', name: 'string', pos: 'string', season: 'string' },
};

/** 라우트별 최상위 응답 형태. 키는 `METHOD 경로`(경로 파라미터는 `:name`). */
export const ROUTES: Record<string, Shape> = {
  'GET /api/v1/user/:nickname': {
    profile: 'UserProfile', matchType: 'int', matchTabs: 'MatchTab[]', listOk: 'bool',
    requested: 'int', loaded: 'int', summary: 'RecordSummary', avgRating: 'number', score: 'number',
    tier: 'ScoreTier', streak: 'StreakInfo', perf: 'PerfStats', diagnosis: 'Diagnosis',
    week: 'WeeklyRecap', rivals: 'Rival[]', 'nemesis?': 'Rival', matches: 'MatchSummary[]', cards: 'CardLinks',
  },
  'GET /api/v1/user/:nickname/report': {
    matchType: 'int', listOk: 'bool', report: 'MatchReport', insights: 'Insight[]',
  },
  'GET /api/v1/user/:nickname/players': {
    matchType: 'int', sampleGames: 'int', minGames: 'int', squadRating: 'number',
    'squadVerdict?': 'Verdict', 'clinic?': 'Clinic', 'picks?': 'PicksInfo',
    players: 'PlayerCard[]', builderOwner: 'string',
  },
  'GET /api/v1/user/:nickname/playstyle': {
    matchType: 'int', result: 'PlaystyleResult', shots: 'Shot[]',
  },
  'GET /api/v1/match/:matchId': {
    matchId: 'string', matchDate: 'string', matchDateLabel: 'string', matchType: 'int',
    matchTypeName: 'string', me: 'MatchSide', 'opponent?': 'MatchSide',
    verdict: 'Verdict', 'potm?': 'Potm', cardUrl: 'string',
  },
  'GET /api/v1/meta': {
    matchType: 'int', 'date?': 'string', 'mover?': 'Mover', movers: 'Mover[]', lines: 'MetaLine[]',
  },
  'GET /api/v1/player/:spid': {
    spid: 'int', name: 'string', season: 'string', 'pid?': 'int',
    seasons: 'SeasonVariant[]', imageUrl: 'string', ranker: 'RankerMeta',
  },
  'GET /api/v1/home': {
    'demoNickname?': 'string', liveSearches: 'string[]', 'mover?': 'Mover',
    'pickDate?': 'string', videos: 'YtVideo[]', posts: 'HomePost[]',
  },
  'GET /api/v1/community/posts': {
    page: 'int', totalPages: 'int', types: 'PostTypeInfo[]', posts: 'Post[]',
  },
  'GET /api/v1/community/posts/:id': {
    post: 'Post', comments: 'Comment[]', viewer: 'Viewer',
  },
  'GET /api/players/search': { players: 'PlayerHit[]' },

  // ── 구 라우트 ────────────────────────────────────────────────
  // 로그인 상태에서의 형태. 비로그인이면 서버가 `{ profile: null }` 만 돌려주고
  // 앱은 로그인 상태에서만 호출한다(토큰 만료 시엔 디코딩 실패 → 비로그인 화면으로 안전하게 강등).
  'GET /api/profile': {
    'profile?': 'MyProfile', posts: 'MyPost[]', squads: 'MySquad[]',
    'snapshot?': 'Snapshot', snapshots: 'FormPoint[]',
  },
  'GET /api/me/notifications': { total: 'int', items: 'NotifItem[]' },
  'GET /api/squad/preset': { formation: 'string', name: 'string', teamTag: 'string', slots: 'SquadSlot[]' },
  'GET /api/squad/from-user': {
    nickname: 'string', formation: 'string', 'matchDate?': 'string', players: 'ImportedPlayer[]',
  },
  'GET /api/squad/:id': {
    id: 'string', name: 'string', formation: 'string', slots: 'SquadSlot[]',
    'teamTag?': 'string', 'createdAt?': 'string',
  },
  // 서버는 소문자 a/b 로 내려준다(웹 BattleVote 도 소문자를 읽는다). mine 은 서버가 주지 않는다.
  'GET /api/community/battle': { a: 'int', b: 'int' },

  // ── 쓰기 라우트 — 검증기가 자동 호출하지 않는다(상태를 바꾸므로). 형태만 고정해 둔다.
  'POST /api/community/battle': { a: 'int', b: 'int' },
  'POST /api/squad': { id: 'string' },
  'POST /api/profile': { ok: 'bool', nickname: 'string' },
  'POST /api/profile/verify': { ok: 'bool' },
  // 앱 익명 사용 기록(배치). 측정 실패도 200 이므로 accepted 로 실제 저장 수를 확인한다.
  'POST /api/v1/events': { ok: 'bool', accepted: 'int' },
};

/** 로그인이 필요해 익명 검증기가 실제 형태를 확인할 수 없는 라우트. */
export const AUTH_ONLY = new Set(['GET /api/profile']);

/** 상태를 바꾸므로 검증기가 호출하면 안 되는 라우트. */
export const WRITE_ONLY = new Set(
  Object.keys(ROUTES).filter((k) => !k.startsWith('GET '))
);

/** 검증 결과 한 건. */
export interface Violation {
  path: string;
  kind: 'missing' | 'null' | 'type' | 'not-array' | 'not-object';
  detail: string;
}

const PRIMITIVES = new Set(['string', 'int', 'number', 'bool', 'any']);

function typeOk(spec: string, v: unknown): boolean {
  switch (spec) {
    case 'any': return true;
    case 'string': return typeof v === 'string';
    case 'bool': return typeof v === 'boolean';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    // Swift 가 Int 로 디코딩하므로 소수점이 있으면 실패한다.
    case 'int': return typeof v === 'number' && Number.isInteger(v);
    default: return false;
  }
}

/**
 * 응답이 계약을 만족하는지 검사. 위반 목록을 돌려준다(빈 배열이면 통과).
 * **추가된 필드는 위반이 아니다** — 앱은 모르는 키를 무시한다.
 */
export function checkShape(shape: Shape, value: unknown, path = ''): Violation[] {
  const out: Violation[] = [];
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return [{ path: path || '(root)', kind: 'not-object', detail: `객체가 아님: ${JSON.stringify(value)?.slice(0, 60)}` }];
  }
  const obj = value as Record<string, unknown>;
  for (const [rawKey, spec] of Object.entries(shape)) {
    const nullable = rawKey.endsWith('?');
    const key = nullable ? rawKey.slice(0, -1) : rawKey;
    const at = path ? `${path}.${key}` : key;
    const has = Object.prototype.hasOwnProperty.call(obj, key);
    const v = obj[key];

    if (!has) {
      // 옵셔널이라도 키 자체가 사라지면 안 되는 경우가 있다(Mover.delta = Int??).
      // 앱이 키 부재를 허용하므로 여기서는 필수 필드만 위반으로 본다.
      if (!nullable) out.push({ path: at, kind: 'missing', detail: '필드가 없음' });
      continue;
    }
    if (v === null || v === undefined) {
      if (!nullable) out.push({ path: at, kind: 'null', detail: '필수 필드인데 null' });
      continue;
    }
    out.push(...checkSpec(spec, v, at));
  }
  return out;
}

function checkSpec(spec: string, v: unknown, at: string): Violation[] {
  if (spec.endsWith('[]')) {
    if (!Array.isArray(v)) return [{ path: at, kind: 'not-array', detail: `배열이 아님: ${typeof v}` }];
    const inner = spec.slice(0, -2);
    const out: Violation[] = [];
    // 원소가 많아도 앞 3개만 본다(오류 메시지 폭발 방지).
    v.slice(0, 3).forEach((el, i) => out.push(...checkSpec(inner, el, `${at}[${i}]`)));
    return out;
  }
  if (PRIMITIVES.has(spec)) {
    return typeOk(spec, v) ? [] : [{ path: at, kind: 'type', detail: `${spec} 여야 하는데 ${describe(v)}` }];
  }
  const nested = SHAPES[spec];
  if (!nested) return [{ path: at, kind: 'type', detail: `알 수 없는 스펙 '${spec}' — SHAPES 에 정의 필요` }];
  return checkShape(nested, v, at);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'number(소수)';
  return typeof v;
}

/** 라우트 키로 검사. 정의가 없으면 빈 배열(계약 대상 아님). */
export function checkRoute(routeKey: string, payload: unknown): Violation[] {
  const shape = ROUTES[routeKey];
  if (!shape) return [];
  return checkShape(shape, payload);
}
