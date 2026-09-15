-- ─────────────────────────────────────────────────────────────
-- 마이그레이션 0001~0018 일괄 검증
--
-- Supabase → SQL Editor 에 통째로 붙여넣고 실행하세요.
-- 결과 표에서 status 가 ❌ 인 줄의 migration 파일만 다시 실행하면 됩니다.
-- 읽기 전용이라 데이터를 바꾸지 않습니다.
-- ─────────────────────────────────────────────────────────────

with checks(migration, object, ok) as (values

  -- 0001 core_cache
  ('0001 core_cache',      'table ouid_cache',            to_regclass('public.ouid_cache')            is not null),
  ('0001 core_cache',      'table match_cache',           to_regclass('public.match_cache')           is not null),
  ('0001 core_cache',      'table ranker_stats_snapshot', to_regclass('public.ranker_stats_snapshot') is not null),

  -- 0002~0007 커뮤니티·스쿼드 기반
  ('0002 vs_votes',        'table vs_votes',              to_regclass('public.vs_votes')              is not null),
  ('0003 squads',          'table squads',                to_regclass('public.squads')                is not null),
  ('0004 profiles',        'table profiles',              to_regclass('public.profiles')              is not null),
  ('0005 club_posts',      'table club_posts',            to_regclass('public.club_posts')            is not null),
  ('0006 community_posts', 'table community_posts',       to_regclass('public.community_posts')       is not null),
  ('0007 comments',        'table community_comments',    to_regclass('public.community_comments')    is not null),

  -- 0008 스쿼드 저장 rate limit
  ('0008 squads_rate_limit', 'squads.ip_hash 컬럼',
    exists(select 1 from information_schema.columns
           where table_schema='public' and table_name='squads' and column_name='ip_hash')),
  ('0008 squads_rate_limit', 'index squads_iphash_created_idx',
    exists(select 1 from pg_indexes where schemaname='public' and indexname='squads_iphash_created_idx')),

  -- 0009 댓글 수 캐시
  ('0009 comment_count',   'community_posts.comment_count 컬럼',
    exists(select 1 from information_schema.columns
           where table_schema='public' and table_name='community_posts' and column_name='comment_count')),

  -- 0010 신고·자동 숨김
  ('0010 reports',         'table reports',               to_regclass('public.reports') is not null),
  ('0010 reports',         'community_posts.hidden 컬럼',
    exists(select 1 from information_schema.columns
           where table_schema='public' and table_name='community_posts' and column_name='hidden')),
  ('0010 reports',         'community_comments.hidden 컬럼',
    exists(select 1 from information_schema.columns
           where table_schema='public' and table_name='community_comments' and column_name='hidden')),

  -- 0011 공지
  ('0011 notices',         'table notices',               to_regclass('public.notices') is not null),
  ('0011 notices',         'index notices_active_idx',
    exists(select 1 from pg_indexes where schemaname='public' and indexname='notices_active_idx')),

  -- 0012 오픈 하드닝
  ('0012 launch_hardening','profiles.consented_at 컬럼',
    exists(select 1 from information_schema.columns
           where table_schema='public' and table_name='profiles' and column_name='consented_at')),

  -- 0013 작성 간격 제한 + 넥슨 kill-switch
  ('0013 rate_limit_flags','table service_flags',         to_regclass('public.service_flags') is not null),
  ('0013 rate_limit_flags','index community_posts_author_created_idx',
    exists(select 1 from pg_indexes where schemaname='public' and indexname='community_posts_author_created_idx')),
  ('0013 rate_limit_flags','index community_comments_author_created_idx',
    exists(select 1 from pg_indexes where schemaname='public' and indexname='community_comments_author_created_idx')),

  -- 0014 스쿼드 배틀 유형
  ('0014 squad_battle',    'constraint community_posts_type_chk',
    exists(select 1 from pg_constraint where conname='community_posts_type_chk')),
  ('0014 squad_battle',    'type_chk 에 squad_battle 포함',
    exists(select 1 from pg_constraint
           where conname='community_posts_type_chk'
             and pg_get_constraintdef(oid) like '%squad_battle%')),

  -- 0015 전적 스냅샷 + 스쿼드 소유자
  ('0015 snapshots_owner', 'table user_snapshots',        to_regclass('public.user_snapshots') is not null),
  ('0015 snapshots_owner', 'squads.user_id 컬럼',
    exists(select 1 from information_schema.columns
           where table_schema='public' and table_name='squads' and column_name='user_id')),

  -- 0016 검색 로그
  ('0016 search_log',      'table search_log',            to_regclass('public.search_log') is not null),
  ('0016 search_log',      'index search_log_last_seen_idx',
    exists(select 1 from pg_indexes where schemaname='public' and indexname='search_log_last_seen_idx')),

  -- 0017 IO 최적화 — GIN 인덱스는 "없어야" 정상(쓰기 증폭 제거)
  ('0017 io_optimization', 'match_cache_ouids_idx 제거됨 (있으면 미실행)',
    not exists(select 1 from pg_indexes where schemaname='public' and indexname='match_cache_ouids_idx')),
  ('0017 io_optimization', 'index ranker_snapshot_type_date_idx 추가됨',
    exists(select 1 from pg_indexes where schemaname='public' and indexname='ranker_snapshot_type_date_idx')),

  -- 0018 푸시 디바이스 토큰 (신규)
  ('0018 device_tokens',   'table device_tokens',         to_regclass('public.device_tokens') is not null),
  ('0018 device_tokens',   'index device_tokens_user_idx',
    exists(select 1 from pg_indexes where schemaname='public' and indexname='device_tokens_user_idx')),

  -- 0019 죽은 스키마 정리 — 셋 다 "없어야" 정상
  ('0019 drop_dead_schema', 'match_cache.ouids 제거됨',
    not exists(select 1 from information_schema.columns
               where table_schema='public' and table_name='match_cache' and column_name='ouids')),
  ('0019 drop_dead_schema', 'ouid_cache 테이블 제거됨',  to_regclass('public.ouid_cache') is null),
  ('0019 drop_dead_schema', 'club_posts 테이블 제거됨',  to_regclass('public.club_posts') is null),

  -- 0021 컬럼 단위 쓰기 권한 (상세는 verify-rls.sql ③)
  ('0021 column_grants',   'posts.created_at UPDATE 회수됨',
    not has_column_privilege('authenticated', 'public.community_posts', 'created_at', 'UPDATE')),
  ('0021 column_grants',   'profiles.verified_ouid UPDATE 회수됨',
    not has_column_privilege('authenticated', 'public.profiles', 'verified_ouid', 'UPDATE')),
  ('0021 column_grants',   'constraint profiles_nickname_len',
    exists(select 1 from pg_constraint where conname = 'profiles_nickname_len'))
)
select
  case when ok then '✅ OK' else '❌ 미실행' end as status,
  migration,
  object
from checks
order by ok, migration, object;
