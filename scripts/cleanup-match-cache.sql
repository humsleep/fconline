-- ─────────────────────────────────────────────────────────────
-- match_cache 용량 정리
--
-- 2026-09-05 실측: 1,664MB / 314,502행. 그중 TOAST(payload)가 1,574MB(95%).
--                  죽은 행은 1,061개뿐이라 bloat 문제가 아니라 "행이 많고 payload가 크다"가 원인.
--                  30일 초과 삭제 대상이 291,415행(92.7%).
--
-- 92% 를 지우는 상황이라 한 행씩 DELETE + VACUUM FULL 은 비효율적이다
-- (1.6GB 를 읽어 122MB 로 재작성 + 긴 배타 잠금). **남길 7% 만 복사하고 원본을 버린다.**
--
-- match_cache 는 캐시다. 잘못돼도 데이터 손실이 아니라 넥슨에서 다시 채워질 뿐이다.
--
-- ✅ 2026-09-05 실행 완료: 1,664MB / 314,502행 → **93MB / 23,347행** (94% 감소).
--    이 파일은 재발 시 재사용할 수 있도록 남겨둔다.
-- ─────────────────────────────────────────────────────────────

-- ⓪ 진단 (읽기 전용)
select
  pg_size_pretty(pg_relation_size('match_cache'))                       as "본체(heap)",
  pg_size_pretty(pg_indexes_size('match_cache'))                        as "인덱스",
  pg_size_pretty(pg_total_relation_size('match_cache')
                 - pg_relation_size('match_cache')
                 - pg_indexes_size('match_cache'))                      as "TOAST(payload)",
  (select round(avg(pg_column_size(payload))) from match_cache)         as "행당 payload(byte)",
  (select n_dead_tup from pg_stat_user_tables where relname='match_cache') as "죽은 행";

select
  count(*)                                              as "행 수",
  pg_size_pretty(pg_total_relation_size('match_cache')) as "총 크기",
  min(match_date)::date                                 as "가장 오래된 경기",
  max(match_date)::date                                 as "가장 최근 경기",
  count(*) filter (where match_date < now() - interval '30 days') as "30일 초과(삭제 대상)"
from match_cache;


-- ─────────────────────────────────────────────────────────────
-- ① 정리 — 통째로 한 번에 실행하세요 (하나의 트랜잭션).
--    중간에 실패하면 전부 롤백되므로 반쯤 망가진 상태가 남지 않습니다.
--    소요: 수십 초. 테이블이 잠기는 구간은 drop/rename 순간뿐입니다.
-- ─────────────────────────────────────────────────────────────
begin;

-- 원본과 동일한 정의로 새 테이블 (LIKE 를 쓰지 않는 이유: 인덱스 이름이 바뀌어
-- 검증 스크립트의 이름 기반 확인이 깨진다)
create table match_cache_new (
  match_id    text primary key,
  match_type  int not null,
  match_date  timestamptz not null,
  ouids       text[] not null default '{}',
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

-- 최근 30일치만 이관 (보관기간과 동일 — 크론도 30일로 맞춰져 있음)
insert into match_cache_new (match_id, match_type, match_date, ouids, payload, created_at)
select match_id, match_type, match_date, ouids, payload, created_at
from match_cache
where match_date >= now() - interval '30 days';

-- 원본 폐기 — DROP 은 공간을 즉시 회수한다(VACUUM FULL 불필요)
drop table match_cache;
alter table match_cache_new rename to match_cache;

-- 이름 원복 + 인덱스 재생성 (0017 에서 GIN 은 제거된 상태가 정상)
alter index match_cache_new_pkey rename to match_cache_pkey;
create index match_cache_type_date_idx on match_cache (match_type, match_date desc);

-- ⚠️ RLS 는 새 테이블에 자동으로 따라오지 않는다. 빠뜨리면 anon 키로 읽힌다.
alter table match_cache enable row level security;

commit;


-- ② 결과 확인 (예상: 약 23,000행 / 약 120MB)
select
  count(*)                                              as "행 수",
  pg_size_pretty(pg_total_relation_size('match_cache')) as "총 크기"
from match_cache;

-- ③ RLS 가 켜져 있고 정책이 0개인지 확인 (서버 전용 테이블의 정상 상태)
select
  relrowsecurity                                        as "RLS 켜짐",
  (select count(*) from pg_policy p where p.polrelid = c.oid) as "정책 수"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'match_cache';
