-- 0006: 커뮤니티 통합 게시판 (0005 club_posts 대체·일반화)
-- 유형: squad_show(자랑) / squad_rate(평가요청) / squad_make(만들어줘)
--       club_recruit(클럽원모집) / club_match(클럽전) / tournament(대회)
-- 읽기 누구나, 작성=로그인+닉네임, 수정/삭제=작성자.

create table if not exists community_posts (
  id          text primary key,
  author_id   uuid not null references auth.users (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null,
  region      text,                          -- 클럽/클럽전 지역(시·도)
  positions   text[] not null default '{}',  -- 클럽 모집 포지션
  contact     text,                          -- 오픈채팅/디스코드
  squad_id    text,                          -- 첨부 스쿼드 공유코드(자랑/평가)
  meta        jsonb not null default '{}',   -- 유형별 추가(budget/schedule/date/format/entry)
  status      text not null default 'open',  -- open | closed
  created_at  timestamptz not null default now(),
  -- API 검증을 DB에서도 강제(anon 클라이언트 직접 insert 방어)
  constraint community_posts_type_chk check (type in (
    'squad_show','squad_rate','squad_make','club_recruit','club_match','tournament'
  )),
  constraint community_posts_status_chk check (status in ('open','closed')),
  constraint community_posts_title_len check (char_length(title) between 1 and 100),
  constraint community_posts_body_len check (char_length(body) between 1 and 4000),
  constraint community_posts_positions_card
    check (coalesce(array_length(positions, 1), 0) <= 6),
  constraint community_posts_contact_len
    check (contact is null or char_length(contact) <= 200),
  constraint community_posts_squad_id_fmt
    check (squad_id is null or squad_id ~ '^[a-zA-Z0-9]{1,32}$'),
  constraint community_posts_meta_size
    check (char_length(meta::text) <= 2000)
);

alter table community_posts enable row level security;

drop policy if exists community_posts_read on community_posts;
create policy community_posts_read on community_posts for select using (true);

drop policy if exists community_posts_insert on community_posts;
create policy community_posts_insert on community_posts
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.nickname is not null
        and length(trim(p.nickname)) > 0
    )
  );

drop policy if exists community_posts_update on community_posts;
create policy community_posts_update on community_posts
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists community_posts_delete on community_posts;
create policy community_posts_delete on community_posts
  for delete using (auth.uid() = author_id);

create index if not exists community_posts_type_created_idx
  on community_posts (type, created_at desc);
create index if not exists community_posts_created_idx
  on community_posts (created_at desc);
create index if not exists community_posts_author_idx
  on community_posts (author_id);
