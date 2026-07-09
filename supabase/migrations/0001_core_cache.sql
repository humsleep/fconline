-- 0001: Sprint 1 코어 캐시 테이블
-- 전부 서버 전용(service_role로만 접근). RLS를 켜고 정책을 만들지 않아
-- anon 키로는 읽기/쓰기 모두 불가 — service_role은 RLS를 우회하므로 서버 라우트만 접근 가능.

-- 닉네임 → ouid 캐시 (닉네임 변경 대응을 위해 updated_at으로 TTL 관리)
create table if not exists ouid_cache (
  nickname    text primary key,
  ouid        text not null,
  updated_at  timestamptz not null default now()
);
alter table ouid_cache enable row level security;

-- 매치 상세 영구 캐시 (경기 결과는 불변 데이터)
create table if not exists match_cache (
  match_id    text primary key,
  match_type  int not null,
  match_date  timestamptz not null,
  ouids       text[] not null default '{}',  -- 참가자 ouid (유저별 경기 조회용)
  payload     jsonb not null,                -- match-detail 원본
  created_at  timestamptz not null default now()
);
alter table match_cache enable row level security;

create index if not exists match_cache_type_date_idx
  on match_cache (match_type, match_date desc);
create index if not exists match_cache_ouids_idx
  on match_cache using gin (ouids);

-- 랭커 스탯 일일 스냅샷 (ranker-stats는 변동 데이터 → 배치 캐시)
create table if not exists ranker_stats_snapshot (
  id          bigint generated always as identity primary key,
  match_type  int not null,
  sp_id       int not null,
  sp_position int not null,
  snapshot_date date not null default current_date,
  payload     jsonb not null,
  unique (match_type, sp_id, sp_position, snapshot_date)
);
alter table ranker_stats_snapshot enable row level security;

create index if not exists ranker_stats_lookup_idx
  on ranker_stats_snapshot (sp_id, sp_position, snapshot_date desc);
