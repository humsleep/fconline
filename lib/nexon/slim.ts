import type { MatchDetail } from './types';

/**
 * match_cache에 저장할 슬림 payload — 앱이 실제로 읽는 필드만 남긴다.
 * 원본 넥슨 match-detail(행당 ~30–80KB)의 미사용 필드를 제거해 쓰기/WAL·읽기량을
 * 대폭 줄인다. 필드 목록은 전 소비자(summary/report/player-stats/playstyle/match
 * 페이지/카드/크론) 사용 감사 기준. 리더는 변경 없음(이름·구조 동일, 부분집합).
 * 구 저장분(풀 payload)은 여분 필드를 그대로 둔 채 무해하게 계속 읽힌다.
 *
 * 순수 함수(서버 의존 없음) — 단위 테스트에서 직접 검증.
 */
export function slimMatchDetail(d: MatchDetail): MatchDetail {
  return {
    matchId: d.matchId,
    matchDate: d.matchDate,
    matchType: d.matchType,
    matchInfo: (d.matchInfo ?? []).map((e) => ({
      ouid: e.ouid,
      nickname: e.nickname,
      matchDetail: e.matchDetail && {
        matchResult: e.matchDetail.matchResult,
        matchEndType: e.matchDetail.matchEndType,
        possession: e.matchDetail.possession,
        averageRating: e.matchDetail.averageRating,
        dribble: e.matchDetail.dribble,
        foul: e.matchDetail.foul,
        yellowCards: e.matchDetail.yellowCards,
        cornerKick: e.matchDetail.cornerKick,
        offsideCount: e.matchDetail.offsideCount,
        controller: e.matchDetail.controller,
      },
      shoot: e.shoot && {
        shootTotal: e.shoot.shootTotal,
        effectiveShootTotal: e.shoot.effectiveShootTotal,
        goalTotal: e.shoot.goalTotal,
        goalTotalDisplay: e.shoot.goalTotalDisplay,
        shootHeading: e.shoot.shootHeading,
        goalHeading: e.shoot.goalHeading,
        shootFreekick: e.shoot.shootFreekick,
        goalFreekick: e.shoot.goalFreekick,
        shootInPenalty: e.shoot.shootInPenalty,
        goalInPenalty: e.shoot.goalInPenalty,
        shootOutPenalty: e.shoot.shootOutPenalty,
        goalOutPenalty: e.shoot.goalOutPenalty,
        shootPenaltyKick: e.shoot.shootPenaltyKick,
        goalPenaltyKick: e.shoot.goalPenaltyKick,
      },
      // shootDetail은 배열 전체 유지(goal-code 판정이 전체 result 분포에 의존).
      // 미사용 per-shot 필드(type/spGrade/spLevel/assist*)만 제거.
      shootDetail: (e.shootDetail ?? []).map((s) => ({
        goalTime: s.goalTime,
        x: s.x,
        y: s.y,
        result: s.result,
        spId: s.spId,
        hitPost: s.hitPost,
        inPenalty: s.inPenalty,
      })),
      pass: e.pass && {
        passTry: e.pass.passTry,
        passSuccess: e.pass.passSuccess,
        shortPassSuccess: e.pass.shortPassSuccess,
        longPassTry: e.pass.longPassTry,
        throughPassTry: e.pass.throughPassTry,
        throughPassSuccess: e.pass.throughPassSuccess,
        lobbedThroughPassTry: e.pass.lobbedThroughPassTry,
      },
      defence: e.defence && {
        tackleTry: e.defence.tackleTry,
        tackleSuccess: e.defence.tackleSuccess,
        blockTry: e.defence.blockTry,
      },
      // player[]는 양측 전원 유지(POTM·평점·크론 빈도 집계가 전체 목록 필요).
      player: (e.player ?? []).map((p) => ({
        spId: p.spId,
        spPosition: p.spPosition,
        status: p.status && {
          spRating: p.status.spRating,
          goal: p.status.goal,
          assist: p.status.assist,
          shoot: p.status.shoot,
          effectiveShoot: p.status.effectiveShoot,
          passTry: p.status.passTry,
          passSuccess: p.status.passSuccess,
          dribbleTry: p.status.dribbleTry,
          dribbleSuccess: p.status.dribbleSuccess,
          tackleTry: p.status.tackleTry,
          tackle: p.status.tackle,
          intercept: p.status.intercept,
        },
      })),
    })),
  };
}
