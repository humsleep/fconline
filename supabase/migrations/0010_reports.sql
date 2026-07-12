-- 0010: 신고 + 자동 숨김 — UGC 운영 최소선.
-- 로그인 유저가 글/댓글을 신고, 같은 대상 신고 5건 누적 시 자동 숨김.

alter table community_posts add column if not exists hidden boolean not null default false;
alter table community_comments add column if not exists hidden boolean not null default false;

create table if not exists reports (
  id           bigint generated always as identity primary key,
  reporter_id  uuid not null references auth.users (id) on delete cascade,
  target_type  text not null check (target_type in ('post', 'comment')),
  target_id    text not null,
  reason       text not null check (reason in ('spam', 'abuse', 'illegal', 'other')),
  created_at   timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)  -- 1인 1신고
);

alter table reports enable row level security;

-- 신고 작성: 로그인 + 본인 명의만. 열람은 없음(운영자는 service_role/SQL로).
drop policy if exists reports_insert on reports;
create policy reports_insert on reports
  for insert with check (auth.uid() = reporter_id);

create index if not exists reports_target_idx on reports (target_type, target_id);

-- 신고 5건 누적 → 대상 자동 숨김
create or replace function auto_hide_on_reports()
returns trigger language plpgsql security definer as $$
declare
  cnt int;
begin
  select count(*) into cnt
  from reports
  where target_type = new.target_type and target_id = new.target_id;

  if cnt >= 5 then
    if new.target_type = 'post' then
      update community_posts set hidden = true where id = new.target_id;
    else
      update community_comments set hidden = true where id = new.target_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reports_auto_hide on reports;
create trigger reports_auto_hide
  after insert on reports
  for each row execute function auto_hide_on_reports();
