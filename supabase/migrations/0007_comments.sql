-- 0007: 커뮤니티 댓글 — "자랑하고 평가받는" 핵심 루프.
-- 읽기 누구나, 작성=로그인+닉네임, 삭제=작성자. 스쿼드 공유코드 첨부 가능(제안 스쿼드).

create table if not exists community_comments (
  id          text primary key,
  post_id     text not null references community_posts (id) on delete cascade,
  author_id   uuid not null references auth.users (id) on delete cascade,
  body        text not null,
  squad_id    text,                          -- 제안 스쿼드 공유코드(선택)
  created_at  timestamptz not null default now(),
  constraint community_comments_body_len check (char_length(body) between 1 and 1000),
  constraint community_comments_squad_id_fmt
    check (squad_id is null or squad_id ~ '^[a-zA-Z0-9]{1,32}$')
);

alter table community_comments enable row level security;

drop policy if exists community_comments_read on community_comments;
create policy community_comments_read on community_comments for select using (true);

drop policy if exists community_comments_insert on community_comments;
create policy community_comments_insert on community_comments
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.nickname is not null
        and length(trim(p.nickname)) > 0
    )
  );

drop policy if exists community_comments_delete on community_comments;
create policy community_comments_delete on community_comments
  for delete using (auth.uid() = author_id);

create index if not exists community_comments_post_idx
  on community_comments (post_id, created_at asc);
