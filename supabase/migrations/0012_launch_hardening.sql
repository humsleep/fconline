-- 0012: 오픈 전 하드닝 (GO/NO-GO 회의 결정)
-- ① hidden 컬럼 보호: 작성자가 자동 숨김을 REST PATCH로 되돌리는 구멍 차단
-- ② 숨김 콘텐츠 읽기 차단: SELECT RLS를 hidden 기준으로 강화(작성자 본인은 열람 가능)
-- ③ 약관 동의 시각 서버 기록용 컬럼

-- ① hidden 변경은 service_role(운영 콘솔)만 — API 경유(anon/authenticated) 변경은 무시
create or replace function protect_hidden_column()
returns trigger language plpgsql as $$
begin
  if new.hidden is distinct from old.hidden
     and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.hidden := old.hidden;
  end if;
  return new;
end $$;

drop trigger if exists community_posts_protect_hidden on community_posts;
create trigger community_posts_protect_hidden
  before update on community_posts
  for each row execute function protect_hidden_column();

drop trigger if exists community_comments_protect_hidden on community_comments;
create trigger community_comments_protect_hidden
  before update on community_comments
  for each row execute function protect_hidden_column();

-- ② 숨김 글/댓글은 데이터 계층에서 차단 (작성자 본인 예외 — 안내 화면용)
drop policy if exists community_posts_read on community_posts;
create policy community_posts_read on community_posts
  for select using (hidden = false or auth.uid() = author_id);

drop policy if exists community_comments_read on community_comments;
create policy community_comments_read on community_comments
  for select using (hidden = false or auth.uid() = author_id);

-- ③ 약관·개인정보 동의 시각 (닉네임 등록 = 최초 인증 쓰기 시점에 기록)
alter table profiles add column if not exists consented_at timestamptz;
