-- 0004: 사용자 프로필 (커뮤니티 신원)
-- Google 로그인(auth.users) + 커뮤니티 표시용 닉네임 + FC Online 구단주명 연동(ouid).
-- 읽기는 누구나(작성자 표시용), 쓰기는 본인만.

create table if not exists profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  nickname           text not null,
  -- FC Online 구단주명 연동 — 검색으로 ouid를 해석해 저장(존재 검증 수준).
  verified_nickname  text,               -- 연동한 FC Online 구단주명(원문)
  verified_ouid      text,               -- 해석된 ouid
  verified_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 닉네임 대소문자 무시 유니크
create unique index if not exists profiles_nickname_key
  on profiles (lower(nickname));
-- 구단주명(ouid) 연동은 한 계정에만 — DB 레벨 유니크로 경쟁 조건/중복 연동 차단
create unique index if not exists profiles_ouid_unique
  on profiles (verified_ouid)
  where verified_ouid is not null;

alter table profiles enable row level security;

-- 작성자 표시를 위해 누구나 읽기 허용(민감 정보 없음)
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (true);

-- 본인 행만 생성/수정/삭제
drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_delete_own on profiles;
create policy profiles_delete_own on profiles
  for delete using (auth.uid() = id);

-- updated_at 자동 갱신
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();
