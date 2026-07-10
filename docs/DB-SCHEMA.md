# DB 스키마 초안 — Supabase Postgres + RLS

> Phase별로 마이그레이션 파일(`supabase/migrations/`)로 확정한다. 이 문서는 설계 초안.
> **⚠️ 실제 적용된 스키마의 진실 소스는 `supabase/migrations/`다.** 아래 Phase 2+ 블록은 초안이며 실제 컬럼과 다를 수 있음.
> RLS 원칙 (BlogLab 검증 패턴): 읽기 `using(true)`, 쓰기 로그인+본인, rate limit은 RLS sub-select + API 사전 체크 이중 방어.

## 적용됨: `0001_core_cache.sql` (Sprint 1~2)

실제 배포된 코어 캐시 테이블. 전부 RLS on + 정책 없음 = service_role(서버) 전용.

- `ouid_cache(nickname pk, ouid, updated_at)` — 닉네임→ouid
- `match_cache(match_id pk, match_type, match_date, ouids[], payload jsonb, created_at)` — 매치 상세 영구 캐시. `ouids` gin 인덱스로 유저별 조회
- `ranker_stats_snapshot(id, match_type, sp_id, sp_position, snapshot_date, payload jsonb)` — 랭커 스탯 일일 스냅샷. unique `(match_type, sp_id, sp_position, snapshot_date)`.
  - **tombstone 규약**: 랭커 데이터가 없는 조합은 `payload = { "empty": true }`로 저장해 당일 재조회를 막는다. 시계열 집계 시 `payload->>'empty'`가 있는 행은 제외.

---

## (초안) Phase 1 — 코어 캐시

```sql
-- 닉네임 → ouid 캐시 (닉변 대응 위해 TTL 갱신)
create table ouid_cache (
  nickname     text primary key,
  ouid         text not null,
  updated_at   timestamptz not null default now()
);

-- 매치 상세 영구 캐시 (경기 결과는 불변)
create table match_cache (
  match_id     text primary key,
  match_type   int not null,
  match_date   timestamptz not null,
  payload      jsonb not null,          -- match-detail 원본
  created_at   timestamptz not null default now()
);
create index on match_cache (match_type, match_date desc);

-- 메타데이터 스냅샷 (spid/seasonid 등, 갱신 감지용)
create table meta_snapshot (
  name         text primary key,        -- 'spid' | 'seasonid' | ...
  payload      jsonb not null,
  updated_at   timestamptz not null default now()
);
```

## Phase 2 — 스쿼드 클리닉

```sql
create table profiles (            -- BlogLab profiles 패턴 이식
  user_id      uuid primary key references auth.users,
  nickname     text unique not null,          -- 서비스 닉네임
  fc_nickname  text,                          -- 게임 닉네임
  ouid         text,                          -- 연동된 계정 식별자
  created_at   timestamptz not null default now()
);

create table squad_reports (       -- 진단 결과 누적 (diagnose_results 패턴)
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users,    -- null = 비로그인
  ouid         text not null,
  score        int not null,                  -- 0~100
  band         text not null,
  payload      jsonb not null,                -- 평가 상세(약점/추천)
  created_at   timestamptz not null default now()
);
-- rate limit: 12h 1회 (RLS sub-select + API 체크)
```

## Phase 3 — VS 판독기

```sql
create table vs_battles (
  id           bigint generated always as identity primary key,
  sp_id_a      int not null, sp_position_a int not null,
  sp_id_b      int not null, sp_position_b int not null,
  stats_snapshot jsonb not null,      -- 판정 당시 ranker-stats
  created_at   timestamptz not null default now(),
  unique (sp_id_a, sp_position_a, sp_id_b, sp_position_b)
);

create table vs_votes (
  battle_id    bigint references vs_battles on delete cascade,
  user_id      uuid references auth.users,
  pick         char(1) not null check (pick in ('A','B')),
  primary key (battle_id, user_id)
);
```

## Phase 4 — 현실 라인업 스쿼드

```sql
-- 실선수 ↔ FC온라인 카드 매핑 (쌓일수록 독점 자산)
create table player_mapping (
  api_football_id  int primary key,
  fc_pid           int,                       -- null = 게임에 없음
  real_name        text not null,
  confidence       real not null,             -- LLM 매칭 신뢰도
  verified         boolean not null default false,  -- 수동 확인
  updated_at       timestamptz not null default now()
);

create table lineup_cache (          -- API-Football 라인업 (경기 후 불변)
  fixture_id   int primary key,
  team_id      int not null,
  formation    text not null,
  lineup       jsonb not null,       -- 11명 + grid
  kickoff_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create table real_squads (           -- 생성된 스쿼드 (공유용)
  id           bigint generated always as identity primary key,
  fixture_id   int not null,
  team_id      int not null,
  cards        jsonb not null,       -- [{spid, position, grid}]
  created_by   uuid references auth.users,
  created_at   timestamptz not null default now()
);
```

## Phase 5 — 커뮤니티

```sql
-- 5a. 클럽 모집 (BlogLab swap_posts 패턴: 1일 1글 RLS)
create table club_posts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users,
  kind         text not null check (kind in ('recruit','join')), -- 모집/가입희망
  club_name    text not null,
  requirement  jsonb,                -- 등급/포지션/활동시간
  body         text not null,
  hidden       boolean not null default false,   -- 신고 누적 자동 숨김
  created_at   timestamptz not null default now()
);

-- 5b. 유저 대회
create table tournaments (
  id           bigint generated always as identity primary key,
  host_id      uuid not null references auth.users,
  title        text not null,
  match_type   int not null,          -- 검증에 쓸 matchtype
  size         int not null check (size in (8,16)),
  status       text not null default 'recruiting',
  -- recruiting → ongoing → finished
  starts_at    timestamptz not null,
  created_at   timestamptz not null default now()
);

create table tournament_entries (
  tournament_id bigint references tournaments on delete cascade,
  user_id      uuid references auth.users,
  ouid         text not null,         -- 결과 자동 검증용
  seed         int,
  primary key (tournament_id, user_id)
);

create table tournament_matches (
  id           bigint generated always as identity primary key,
  tournament_id bigint not null references tournaments on delete cascade,
  round        int not null,
  entry_a      uuid not null,
  entry_b      uuid not null,
  nexon_match_id text,                -- API로 대조된 실제 매치
  winner       uuid,
  verified     boolean not null default false,
  verified_at  timestamptz
);

-- 5c. 교류전: tournaments 구조 재사용 + club 단위 (추후 확정)
```

## 공통 정책

- 신고/모더레이션: BlogLab `reports_and_moderation`(5건 누적 자동 숨김) 패턴 이식
- 닉네임 변경 24h 쿨다운 트리거 이식
- service role은 서버 라우트 전용 (`lib/supabase/admin`)
