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
