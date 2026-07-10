-- 0002: VS 판독기 투표 (Sprint 3)
-- 서버 전용(service_role). RLS on + 정책 없음.

create table if not exists vs_votes (
  vs_key     text not null,          -- 정규화된 대결 키 "minSpId:maxSpId:pos"
  voter      text not null,          -- 익명 브라우저 id(localStorage) — 로그인 불필요
  pick       char(1) not null check (pick in ('A', 'B')),
  created_at timestamptz not null default now(),
  primary key (vs_key, voter)
);
alter table vs_votes enable row level security;

create index if not exists vs_votes_key_idx on vs_votes (vs_key);
