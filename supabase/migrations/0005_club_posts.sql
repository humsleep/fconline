-- 0005: 클럽 모집 게시판 (커뮤니티 5a)
-- 읽기는 누구나, 작성은 로그인 + 닉네임 등록된 본인만. 수정/삭제는 작성자만.

create table if not exists club_posts (
  id           text primary key,            -- 짧은 공유 코드
  author_id    uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  body         text not null,
  region       text,                        -- 시/도 (선택)
  positions    text[] not null default '{}',-- 모집 포지션 코드 라벨 배열
  play_style   text,                        -- 지향 플레이(선택, 자유 텍스트/태그)
  contact      text,                        -- 오픈채팅/디스코드 등 연락 수단(선택)
  status       text not null default 'open',-- 'open' | 'closed'
  created_at   timestamptz not null default now()
);

alter table club_posts enable row level security;

-- 누구나 읽기
drop policy if exists club_posts_read on club_posts;
create policy club_posts_read on club_posts for select using (true);

-- 작성: 본인 + 닉네임 등록된 프로필 보유자만
drop policy if exists club_posts_insert on club_posts;
create policy club_posts_insert on club_posts
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.nickname is not null
        and length(trim(p.nickname)) > 0
    )
  );

-- 수정/삭제: 작성자만
drop policy if exists club_posts_update on club_posts;
create policy club_posts_update on club_posts
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists club_posts_delete on club_posts;
create policy club_posts_delete on club_posts
  for delete using (auth.uid() = author_id);

create index if not exists club_posts_created_idx
  on club_posts (status, created_at desc);
create index if not exists club_posts_author_idx on club_posts (author_id);
