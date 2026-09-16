-- ─────────────────────────────────────────────────────────────
-- 보안 확인: 앱이 anon 키로 붙으므로 RLS 상태를 함께 점검합니다.
-- 위 verify-migrations.sql 과 별개로 한 번 실행해 주세요.
-- ─────────────────────────────────────────────────────────────

-- ① RLS 활성 여부 (전부 true 여야 함)
select
  case when c.relrowsecurity then '✅' else '🔴 RLS 꺼짐' end as rls,
  c.relname as "테이블",
  count(p.polname) as "정책 수",
  case
    when not c.relrowsecurity then '즉시 조치 필요'
    when count(p.polname) = 0 then '서버 전용(service_role만 접근) — 의도된 설계'
    else '정책 있음'
  end as "해석"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relrowsecurity, c.relname;

-- ② 테이블 용량 (Supabase 무료 500MB 한도 대비)
select
  relname as "테이블",
  pg_size_pretty(pg_total_relation_size(c.oid)) as "총 크기",
  (select reltuples::bigint from pg_class where oid = c.oid) as "대략 행 수"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc
limit 15;

-- ③ 컬럼 단위 쓰기 권한 (0021) — 전부 ✅ 여야 함
--    RLS 는 행만 막는다. 작성자가 created_at(간격 제한 우회)·verified_*(연동 사칭)를 못 쓰는지 확인.
with checks(object, ok) as (values
  ('posts.created_at UPDATE 불가',         not has_column_privilege('authenticated', 'public.community_posts', 'created_at', 'UPDATE')),
  ('posts.created_at INSERT 불가',         not has_column_privilege('authenticated', 'public.community_posts', 'created_at', 'INSERT')),
  ('posts.comment_count UPDATE 불가',      not has_column_privilege('authenticated', 'public.community_posts', 'comment_count', 'UPDATE')),
  ('posts.type UPDATE 불가',               not has_column_privilege('authenticated', 'public.community_posts', 'type', 'UPDATE')),
  ('posts.title UPDATE 가능(수정 기능)',    has_column_privilege('authenticated', 'public.community_posts', 'title', 'UPDATE')),
  ('posts.status UPDATE 가능(마감 토글)',   has_column_privilege('authenticated', 'public.community_posts', 'status', 'UPDATE')),
  ('posts.body INSERT 가능(글쓰기)',        has_column_privilege('authenticated', 'public.community_posts', 'body', 'INSERT')),
  ('comments.created_at INSERT 불가',      not has_column_privilege('authenticated', 'public.community_comments', 'created_at', 'INSERT')),
  ('comments.body INSERT 가능(댓글)',       has_column_privilege('authenticated', 'public.community_comments', 'body', 'INSERT')),
  ('profiles.verified_ouid UPDATE 불가',   not has_column_privilege('authenticated', 'public.profiles', 'verified_ouid', 'UPDATE')),
  ('profiles.verified_ouid INSERT 불가',   not has_column_privilege('authenticated', 'public.profiles', 'verified_ouid', 'INSERT')),
  ('profiles.consented_at UPDATE 불가',    not has_column_privilege('authenticated', 'public.profiles', 'consented_at', 'UPDATE')),
  ('profiles.nickname UPDATE 가능(닉네임)', has_column_privilege('authenticated', 'public.profiles', 'nickname', 'UPDATE')),
  ('profiles.nickname INSERT 가능(등록)',   has_column_privilege('authenticated', 'public.profiles', 'nickname', 'INSERT')),
  ('anon 은 profiles 쓰기 불가',            not has_table_privilege('anon', 'public.profiles', 'UPDATE')),
  ('profiles_nickname_len 제약 존재',       exists(select 1 from pg_constraint where conname = 'profiles_nickname_len'))
)
select case when ok then '✅' else '🔴' end as status, object as "컬럼 권한 (0021)"
from checks
order by ok, object;

-- ④ 0022 + 운영 상태 (출시 전 최종 확인)
with checks(object, ok) as (values
  ('0022 squads 공개 읽기 정책 제거', not exists(
      select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
      where c.relname = 'squads' and p.polname = 'squads_read')),
  ('0021 닉네임 길이 제약 검증 완료(validate)', exists(
      select 1 from pg_constraint where conname = 'profiles_nickname_len' and convalidated)),
  ('0020 app_events 테이블 존재', to_regclass('public.app_events') is not null),
  ('개정 공지 게시됨(active)', exists(select 1 from public.notices where active))
)
select case when ok then '✅' else '🔴' end as status, object as "출시 전 확인"
from checks
order by ok, object;
