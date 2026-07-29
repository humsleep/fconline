-- 0017_io_optimization.sql
-- NANO 인스턴스 Disk IO 절감 — 미사용 인덱스 제거 + 누락 인덱스 추가.
-- 안전: 읽기 동작 불변(제거하는 인덱스는 어떤 쿼리도 사용하지 않음), 추가 인덱스는 seq scan 제거용.
-- Supabase SQL Editor에서 실행하세요.

-- ① match_cache.ouids GIN 인덱스 제거.
--    앱 어디에서도 ouids(참가자 배열)로 조회하지 않는데(코드 전수 확인),
--    /user 콜드 조회마다 최대 30건 insert 때 GIN 인덱스가 매번 갱신된다.
--    GIN 유지비용은 인덱스 중 가장 비싼 축 → 순수 쓰기 증폭. 읽기 영향 0.
drop index if exists match_cache_ouids_idx;

-- ② ranker_stats_snapshot (match_type, snapshot_date desc) 인덱스 추가.
--    loadPicks()가 match_type + snapshot_date로 필터/정렬하는데 기존 인덱스는
--    (sp_id, sp_position, snapshot_date)라 선두 컬럼 불일치로 못 쓴다 →
--    스쿼드 뷰 렌더마다 seq scan(limit 300/400). 인덱스로 제거.
create index if not exists ranker_snapshot_type_date_idx
  on ranker_stats_snapshot (match_type, snapshot_date desc);
