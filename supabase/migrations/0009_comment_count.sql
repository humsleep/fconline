-- 0009: 게시글 댓글 수 비정규화 — 목록에서 💬N 표시용 (트리거로 유지)

alter table community_posts
  add column if not exists comment_count int not null default 0;

create or replace function bump_comment_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update community_posts set comment_count = comment_count + 1
      where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update community_posts set comment_count = greatest(comment_count - 1, 0)
      where id = old.post_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists community_comments_count on community_comments;
create trigger community_comments_count
  after insert or delete on community_comments
  for each row execute function bump_comment_count();

-- 기존 댓글 반영(재실행 안전)
update community_posts p
set comment_count = coalesce(c.n, 0)
from (
  select post_id, count(*)::int as n
  from community_comments
  group by post_id
) c
where p.id = c.post_id;
