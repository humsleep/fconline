-- 0011: 공지 배너 — 운영자가 배포 없이 공지/이벤트를 띄우는 채널.
-- 읽기: 활성 공지만 누구나. 쓰기: service_role(관리 API) 전용.

create table if not exists notices (
  id          bigint generated always as identity primary key,
  text        text not null check (char_length(text) between 1 and 200),
  link        text,                          -- 선택: 자세히 보기 링크(내부 경로 권장)
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table notices enable row level security;

drop policy if exists notices_read_active on notices;
create policy notices_read_active on notices
  for select using (active = true);

create index if not exists notices_active_idx on notices (active, created_at desc);
