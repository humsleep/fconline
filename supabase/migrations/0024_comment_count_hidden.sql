-- 0024: comment_count 에서 숨김(hidden) 댓글 제외
--
-- 문제(iOS 팀 보고): 0009 bump_comment_count 트리거는 INSERT/DELETE 만 센다. 신고 누적으로 숨겨진 댓글
-- (0010 auto_hide_on_reports → hidden = true)이 comment_count 에 그대로 남아, 목록의 💬N 과
-- 상세의 댓글 목록(lib/community/posts.ts listComments 가 hidden 을 거른다)이 어긋났다.
--
-- 이 파일:
--   1. bump_comment_count 를 교체 — 보이는(hidden = false) 댓글만 센다.
--      · INSERT: hidden = false 일 때만 +1
--      · DELETE: 지워진 댓글이 숨김이 아니었을 때만 -1 (숨김 → 삭제가 두 번 빠지던 것도 막는다)
--      · UPDATE OF hidden: false → true 면 -1, true → false(운영 콘솔 복구) 면 +1
--   2. UPDATE 트리거 추가(after update of hidden). 0012 protect_hidden_column 이 BEFORE 에서 비-service_role 의
--      hidden 변경을 되돌리므로, AFTER 에서는 실제로 바뀐 경우만 보인다.
--   3. 기존 글 전부 1회 재집계(숨김 제외). 댓글이 없는 글은 0 으로.
--
-- 재실행 안전(create or replace / drop trigger if exists / 재집계는 멱등).
-- Supabase SQL Editor 에 통째로 붙여넣고 실행.
-- 참고: listComments 는 최대 200개만 내려준다 — comment_count 는 그보다 클 수 있다(표시용 총계라 의도된 차이).

begin;

create or replace function public.bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not coalesce(new.hidden, false) then
      update public.community_posts set comment_count = comment_count + 1
        where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if not coalesce(old.hidden, false) then
      update public.community_posts set comment_count = greatest(comment_count - 1, 0)
        where id = old.post_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if coalesce(old.hidden, false) is distinct from coalesce(new.hidden, false) then
      if new.hidden then
        update public.community_posts set comment_count = greatest(comment_count - 1, 0)
          where id = new.post_id;
      else
        update public.community_posts set comment_count = comment_count + 1
          where id = new.post_id;
      end if;
    end if;
    return new;
  end if;
  return null;
end $$;

-- INSERT/DELETE 트리거는 0009 그대로(같은 함수를 부른다). 재실행 안전하게 다시 만든다.
drop trigger if exists community_comments_count on public.community_comments;
create trigger community_comments_count
  after insert or delete on public.community_comments
  for each row execute function public.bump_comment_count();

drop trigger if exists community_comments_count_hidden on public.community_comments;
create trigger community_comments_count_hidden
  after update of hidden on public.community_comments
  for each row
  when (old.hidden is distinct from new.hidden)
  execute function public.bump_comment_count();

-- 1회 재집계 — 숨김 제외. 값이 같은 글은 건드리지 않는다(불필요한 쓰기·updated_at 류 트리거 방지).
update public.community_posts p
set comment_count = coalesce(c.n, 0)
from public.community_posts p2
left join (
  select post_id, count(*)::int as n
  from public.community_comments
  where hidden = false
  group by post_id
) c on c.post_id = p2.id
where p.id = p2.id
  and p.comment_count is distinct from coalesce(c.n, 0);

commit;

-- 확인(선택): 0 행이면 정상
-- select p.id, p.comment_count,
--        (select count(*) from public.community_comments c where c.post_id = p.id and c.hidden = false) as visible
-- from public.community_posts p
-- where p.comment_count <> (select count(*) from public.community_comments c where c.post_id = p.id and c.hidden = false);
