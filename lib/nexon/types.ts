/** 넥슨 오픈API FC온라인 응답 타입 — docs/NEXON-API.md 참조 */

export interface UserBasic {
  ouid: string;
  nickname: string;
  level: number;
}

export interface MaxDivision {
  matchType: number;
  division: number;
  achievementDate: string; // UTC
}

export interface MatchDetailSummary {
  seasonId: number;
  matchResult: '승' | '무' | '패' | string;
  matchEndType: number; // 0 정상 | 1 몰수승 | 2 몰수패
  systemPause: number;
  foul: number;
  injury: number;
  redCards: number;
  yellowCards: number;
  dribble: number;
  cornerKick: number;
  possession: number;
  offsideCount: number;
  averageRating: number;
  controller: string;
}

export interface Shoot {
  shootTotal: number;
  effectiveShootTotal: number;
  goalTotal: number;
  goalTotalDisplay: number;
  ownGoal: number;
  shootHeading: number;
  goalHeading: number;
  shootFreekick: number;
  goalFreekick: number;
  shootInPenalty: number;
  goalInPenalty: number;
  shootOutPenalty: number;
  goalOutPenalty: number;
  shootPenaltyKick: number;
  goalPenaltyKick: number;
  shootOutScore?: number;
}

export interface ShootDetail {
  goalTime: number;
  x: number;
  y: number;
  type: number;
  result: number;
  spId: number;
  spGrade: number;
  spLevel: number;
  spIdAssist?: number;
  assistX?: number;
  assistY?: number;
  hitPost: boolean;
  inPenalty: boolean;
}

export interface Pass {
  passTry: number;
  passSuccess: number;
  shortPassTry: number;
  shortPassSuccess: number;
  longPassTry: number;
  longPassSuccess: number;
  throughPassTry: number;
  throughPassSuccess: number;
  lobbedThroughPassTry: number;
  lobbedThroughPassSuccess: number;
  bouncingLobPassTry: number;
  bouncingLobPassSuccess: number;
  drivenGroundPassTry: number;
  drivenGroundPassSuccess: number;
}

export interface Defence {
  blockTry: number;
  blockSuccess: number;
  tackleTry: number;
  tackleSuccess: number;
}

export interface PlayerStatus {
  goal: number;
  assist: number;
  shoot: number;
  effectiveShoot: number;
  passTry: number;
  passSuccess: number;
  dribbleTry: number;
  dribbleSuccess: number;
  ballPossesionTry: number; // 오타가 공식 스펙
  ballPossesionSuccess: number;
  aerialTry: number;
  aerialSuccess: number;
  blockTry: number;
  block: number;
  tackleTry: number;
  tackle: number;
  intercept: number;
  defending: number;
  yellowCards: number;
  redCards: number;
  spRating: number;
}

export interface MatchPlayer {
  spId: number;
  spPosition: number;
  spGrade: number;
  status: PlayerStatus;
}

export interface MatchInfoEntry {
  ouid: string;
  nickname: string;
  matchDetail: MatchDetailSummary;
  shoot: Shoot;
  shootDetail: ShootDetail[];
  pass: Pass;
  defence: Defence;
  player: MatchPlayer[];
}

export interface MatchDetail {
  matchId: string;
  matchDate: string; // UTC, 'Z' 없이 올 수 있음
  matchType: number;
  matchInfo: MatchInfoEntry[];
}
