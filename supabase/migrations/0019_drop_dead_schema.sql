-- 0019: 죽은 스키마 정리 — 읽는 코드가 없는 컬럼·테이블 제거.
--
-- 2026-09-05 코드 전수 확인 결과:
--   · match_cache.ouids — 저장은 하는데 조회하는 쿼리가 없다. 0017 에서 같은 이유로
--     GIN 인덱스를 이미 제거했다. 매 저장마다 쓰이므로 WAL·용량 순손실.
--   · ouid_cache        — 어떤 코드도 참조하지 않는다(닉네임→ouid 는 Next 데이터 캐시가 담당).
--   · club_posts        — 커뮤니티가 community_posts 로 통합된 뒤 남은 잔재. 참조 코드 0.
--
-- ⚠️ 되돌릴 수 없다. 실행 전 아래로 현재 상태를 먼저 확인하세요.
--    (count(*) 는 테이블이 없으면 42P01 에러가 난다 → to_regclass 로 확인할 것)
--
--   select
--     to_regclass('public.ouid_cache')::text as ouid_cache,   -- null = 이미 없음
--     to_regclass('public.club_posts')::text as club_posts,
--     (select count(*) from information_schema.columns
--       where table_schema='public' and table_name='match_cache'
--         and column_name='ouids') as ouids_col;              -- 0 = 이미 제거됨
--
--   테이블이 남아 있고 비었는지 보려면(존재할 때만):
--     select count(*) from club_posts;
--
-- 아래 세 문장은 모두 `if exists` 라 이미 없어도 에러 없이 통과한다.

alter table if exists match_cache drop column if exists ouids;

drop table if exists ouid_cache;
drop table if exists club_posts;
