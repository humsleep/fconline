# 넥슨 오픈API — FC온라인 레퍼런스

> 2026-07 분석. 공식 문서: https://openapi.nexon.com/game/fconline/
> 비공식 소스(스키마 검증): bluuewhale/nexon-openapi-python, 실사용 오픈소스 코드.
> ⚠️ 표시 항목은 공식 문서에서 최종 확인 필요.

## 공통

- **베이스 URL**: `https://open.api.nexon.com`
- **인증**: 요청 헤더 `x-nxopen-api-key: {키}` — openapi.nexon.com에서 발급
- 전부 `GET`, 응답 JSON (이미지 제외), 날짜는 UTC
- 2024-03-07 호스트 이전: 구 `public.api.nexon.com/openapi/fconline/v1.0/*` → 현 `open.api.nexon.com/fconline/v1/*`, `accessId` → `ouid` 개명

### 공통 에러 코드

| 코드 | HTTP | 의미 |
|---|---|---|
| OPENAPI00001 | 500 | 서버 내부 오류 |
| OPENAPI00002 | 403 | 권한 없음 |
| OPENAPI00003 | 400 | 유효하지 않은 식별자 |
| OPENAPI00004 | 400 | 파라미터 누락/오류 |
| OPENAPI00005 | 400 | 유효하지 않은 API KEY |
| OPENAPI00006 | 400 | 유효하지 않은 경로 |
| OPENAPI00007 | 429 | 호출량 초과 |
| OPENAPI00009 | 400 | 데이터 준비 중 |
| OPENAPI00010 | 400 | 게임 점검 중 |

## 1. 계정

```
GET /fconline/v1/id?nickname={닉네임}   →   { "ouid": string }
```
모든 유저 API의 선행 호출. 닉네임 변경 직후에는 조회 실패 가능.

## 2. 유저 정보

### 기본 정보
```
GET /fconline/v1/user/basic?ouid=
→ { ouid, nickname, level }
```

### 역대 최고 등급
```
GET /fconline/v1/user/maxdivision?ouid=
→ [{ matchType, division, achievementDate }]
```
division 해석: 공식경기 `division.json`, 볼타 `division_volta.json`.

### 매치 목록
```
GET /fconline/v1/user/match?ouid=&matchtype=&offset=&limit=
→ [ matchId: string, ... ]   (최신순, limit 최대 100)
```
ID만 반환 → 상세는 match-detail 개별 조회 (N+1 주의).

### 거래 기록 (이적시장)
```
GET /fconline/v1/user/trade?ouid=&tradetype=&offset=&limit=
→ [{ tradeDate, saleSn, spid, grade, value }]
```
- `tradetype`: `buy` | `sell`
- ⚠️ 래퍼 문서상 "본인 거래 기록만 조회 가능"

## 3. 매치 상세

```
GET /fconline/v1/match-detail?matchid={matchId}
```

```
{
  matchId, matchDate, matchType,
  matchInfo: [            // 참가자별 1개 (1:1이면 2개)
    {
      ouid, nickname,
      matchDetail: {      // 경기 요약
        seasonId,
        matchResult,      // "승" | "무" | "패" (한글!)
        matchEndType,     // 0 정상 | 1 몰수승 | 2 몰수패
        systemPause, foul, injury, redCards, yellowCards,
        dribble, cornerKick, possession, offsideCount,
        averageRating, controller
      },
      shoot: {
        shootTotal, effectiveShootTotal, goalTotal, goalTotalDisplay,
        ownGoal, shootHeading, goalHeading, shootFreekick, goalFreekick,
        shootInPenalty, goalInPenalty, shootOutPenalty, goalOutPenalty,
        shootPenaltyKick, goalPenaltyKick, shootOutScore
      },
      shootDetail: [{     // 슛 이벤트 로그 (좌표!)
        goalTime, x, y,
        type,             // ⚠️ 슛 종류 코드
        result,           // ⚠️ 결과 코드
        spId, spGrade, spLevel,
        spIdAssist, assistX, assistY,
        hitPost, inPenalty
      }],
      pass: {             // 유형별 시도/성공
        passTry, passSuccess, shortPassTry, shortPassSuccess,
        longPassTry, longPassSuccess, throughPassTry, throughPassSuccess,
        lobbedThroughPassTry, lobbedThroughPassSuccess,
        bouncingLobPassTry, bouncingLobPassSuccess,
        drivenGroundPassTry, drivenGroundPassSuccess
      },
      defence: { blockTry, blockSuccess, tackleTry, tackleSuccess },
      player: [{          // 출전 선수별
        spId, spPosition, spGrade,
        status: {
          goal, assist, shoot, effectiveShoot,
          passTry, passSuccess, dribbleTry, dribbleSuccess,
          ballPossesionTry, ballPossesionSuccess,   // 오타가 공식 스펙
          aerialTry, aerialSuccess, blockTry, block,
          tackleTry, tackle, intercept, defending,
          yellowCards, redCards, spRating
        }
      }]
    }
  ]
}
```

경기 결과는 불변 → matchId 기준 영구 캐시 가능.

## 4. 랭커 정보

```
GET /fconline/v1/ranker-stats?matchtype=&players={URL인코딩 JSON}
players = [{"id": spid, "po": spposition}, ...]
→ [{ spId, spPosition, createDate, status: { ...player.status 계열 + matchCount } }]
```
상위 랭커의 선수×포지션별 평균 스탯. ⚠️ 1회 최대 조합 수·집계 기간·갱신 주기는 문서 확인.

## 5. 메타데이터 (인증 불필요, 캐싱 1순위)

베이스: `https://open.api.nexon.com/static/fconline/meta/`

| 파일 | 내용 |
|---|---|
| `matchtype.json` | 매치 종류 (30 리그친선, 40 클래식1on1, 50 공식경기, 52 감독모드, 60 공식친선, 204/214/224 볼타…) |
| `spid.json` | 전체 선수 id·이름(한국어). **spid = 시즌ID 3자리 + pid 6자리** |
| `seasonid.json` | 시즌(클래스) id·이름·아이콘 |
| `spposition.json` | 포지션 코드 (0 GK ~ 28 SUB) |
| `division.json` | 공식경기 등급 (800 슈퍼챔피언스 ~ 3100 유망주3) |
| `division_volta.json` | 볼타 등급 |

## 6. 이미지 (넥슨 CDN, 인증 불필요)

```
액션샷:   https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p{spid}.png
기본 이미지: https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/players/p{pid}.png
```
- 폴백 체인: 액션샷(spid) → 기본(pid) → 실루엣
- 브라우저 직접 로드 시 CORS 이슈 → 서버 프록시 경유

## 구현 주의사항

1. **레이트리밋**: 병렬 호출 시 429 빈발 (실사례 확인) → 순차 큐잉
2. **N+1**: 매치 목록은 ID만 → N경기 분석 = N+1 호출 → 캐시 필수
3. **닉네임 변경**: 변경 직후 매치 상세의 상대 조회 실패 사례 → 예외 처리
4. 프로덕션 minify로 에러 클래스명 비교 불가 → `err.status` + 코드 문자열로 분류
