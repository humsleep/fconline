-- 0003: 스쿼드 빌더 저장 (공유용)
-- 읽기는 누구나(공유 링크), 쓰기는 서버(service_role)만. RLS on.

create table if not exists squads (
  id          text primary key,          -- 짧은 공유 코드
  name        text not null,
  formation   text not null,             -- '433' 등
  slots       jsonb not null,            -- [{ slotId, spid, name }]
  team_tag    text,                      -- 프리셋 출처(예: 'arsenal') 또는 null
  created_at  timestamptz not null default now()
);
alter table squads enable row level security;

-- 공유 링크로 누구나 읽기 허용
create policy squads_read on squads for select using (true);

create index if not exists squads_created_idx on squads (created_at desc);
