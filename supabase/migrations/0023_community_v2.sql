-- 0023: 커뮤니티 v2 — 조회수 · 좋아요(글/댓글) · 1단 답글
--
-- 앱(iOS Community v2) 백엔드. 코드가 이 마이그레이션보다 **먼저 배포돼도** 안전하다:
--   · 글·댓글은 select('*') 라 새 컬럼이 없으면 응답에서 빠질 뿐이다(전부 옵셔널 필드).
--   · 좋아요/조회수/답글/정렬 코드는 42703(컬럼 없음)·42P01(테이블 없음)·PGRST202/204 를 잡아 기능만 끈다.
-- 그래도 배포 후 이 파일을 실행해야 기능이 켜진다. SQL Editor 에서 통째로 실행(재실행 안전).
--
-- 권한 모델(0021 과 같은 원칙 — 컬럼 단위 쓰기):
--   · view_count / like_count 는 유저가 직접 쓸 수 없다(0021 의 컬럼 grant 에 없음).
--     조회수는 security definer RPC, 좋아요 수는 security definer 트리거로만 바뀐다.
--   · post_likes / comment_likes: 본인 행만 insert/delete/select. 남의 좋아요 목록은 안 보인다
--     (수는 like_count 컬럼으로 노출).
--   · community_comments.parent_id 는 insert 컬럼 grant 를 추가한다(안 하면 42501).

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. 컬럼
-- ─────────────────────────────────────────────────────────────
alter table public.community_posts
  add column if not exists view_count int not null default 0,
  add column if not exists like_count int not null default 0;

alter table public.community_comments
  add column if not exists parent_id text references public.community_comments (id) on delete set null,
  add column if not exists like_count int not null default 0;
-- 원 댓글이 지워지면 답글은 남기고 최상위로 올린다(남의 글을 연쇄 삭제하지 않음).
-- 1단 평면화는 서버가 보장한다(답글의 답글 → 원 댓글로 붙임). DB 는 같은 글 소속만 강제한다.

create index if not exists community_comments_parent_idx
  on public.community_comments (parent_id) where parent_id is not null;

-- 인기/댓글순 정렬용 — 최근 글 범위 스캔
create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc);

-- 답글 컬럼 쓰기 권한(0021 은 테이블 단위 INSERT 를 회수했다)
grant insert (parent_id) on public.community_comments to authenticated;

-- 답글은 같은 글의 댓글에만 — API 를 우회한 REST 직접 호출 방어
create or replace function public.check_comment_parent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  if new.parent_id is null then
    return new;
  end if;
  select post_id, parent_id into p from public.community_comments where id = new.parent_id;
  if not found or p.post_id <> new.post_id then
    raise exception 'invalid parent comment' using errcode = '23514';
  end if;
  -- 1단 평면화: 답글의 답글은 원 댓글에 붙인다
  if p.parent_id is not null then
    new.parent_id := p.parent_id;
  end if;
  return new;
end $$;

drop trigger if exists community_comments_parent_check on public.community_comments;
create trigger community_comments_parent_check
  before insert on public.community_comments
  for each row execute function public.check_comment_parent();

-- ─────────────────────────────────────────────────────────────
-- 2. 좋아요 테이블
-- ─────────────────────────────────────────────────────────────
create table if not exists public.post_likes (
  post_id    text not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);

create table if not exists public.comment_likes (
  comment_id text not null references public.community_comments (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_likes_user_idx on public.comment_likes (user_id);

alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;

drop policy if exists post_likes_select_own on public.post_likes;
create policy post_likes_select_own on public.post_likes
  for select using (auth.uid() = user_id);
drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes
  for insert with check (auth.uid() = user_id);
drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own on public.post_likes
  for delete using (auth.uid() = user_id);

drop policy if exists comment_likes_select_own on public.comment_likes;
create policy comment_likes_select_own on public.comment_likes
  for select using (auth.uid() = user_id);
drop policy if exists comment_likes_insert_own on public.comment_likes;
create policy comment_likes_insert_own on public.comment_likes
  for insert with check (auth.uid() = user_id);
drop policy if exists comment_likes_delete_own on public.comment_likes;
create policy comment_likes_delete_own on public.comment_likes
  for delete using (auth.uid() = user_id);

revoke all on public.post_likes, public.comment_likes from anon, authenticated;
grant select, delete on public.post_likes, public.comment_likes to authenticated;
-- created_at 은 기본값 고정(조작 불가)
grant insert (post_id, user_id) on public.post_likes to authenticated;
grant insert (comment_id, user_id) on public.comment_likes to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. 좋아요 수 트리거 (0009 bump_comment_count 와 같은 방식)
-- ─────────────────────────────────────────────────────────────
create or replace function public.bump_post_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update community_posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update community_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.bump_post_like_count();

create or replace function public.bump_comment_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update community_comments set like_count = like_count + 1 where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update community_comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists comment_likes_count on public.comment_likes;
create trigger comment_likes_count
  after insert or delete on public.comment_likes
  for each row execute function public.bump_comment_like_count();

-- ─────────────────────────────────────────────────────────────
-- 4. 조회수 RPC — UPDATE 한 번. 반환값은 증가 후 조회수(없거나 숨김 글이면 null).
--    봇 제외·중복 제거는 서버 라우트가 한다(UA 필터). REST 로 직접 부를 수는 있지만
--    조회수는 순위 가중치가 낮다(views/50) — 조작 이득이 작다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.increment_post_view(p_id text)
returns int language sql security definer set search_path = public as $$
  update community_posts
     set view_count = view_count + 1
   where id = p_id and hidden = false
  returning view_count;
$$;

revoke all on function public.increment_post_view(text) from public;
grant execute on function public.increment_post_view(text) to anon, authenticated;

-- 기존 데이터 재집계(재실행 안전)
update public.community_posts p
   set like_count = coalesce((select count(*)::int from public.post_likes l where l.post_id = p.id), 0);
update public.community_comments c
   set like_count = coalesce((select count(*)::int from public.comment_likes l where l.comment_id = c.id), 0);

commit;

notify pgrst, 'reload schema';
