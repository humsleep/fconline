-- diagnostics.sql — Supabase(fconline-lab) WAL/디스크/IO 진단 모음
-- 사용:  psql "$SUPABASE_DB_URL" -f scripts/diagnostics.sql
--   또는 Supabase Dashboard → SQL Editor 에 개별 블록 붙여넣기
-- 기준선(2026-07-30 복구 직후): WAL 224MB / DB 1580MB / CPU 94%(크레딧 고갈 스로틀)

-- [1] 용량 현황 (가장 먼저 볼 것)
select (select pg_size_pretty(sum(size)) from pg_ls_waldir()) as wal,
       pg_size_pretty(pg_database_size(current_database()))   as db;
-- WAL이 1GB를 넘어가면 체크포인트 지연 신호

-- [2] WAL 관련 설정
select name, setting, unit from pg_settings
where name in ('max_wal_size','min_wal_size','checkpoint_timeout',
               'checkpoint_completion_target','wal_keep_size','archive_mode');

-- [3] WAL 아카이버 상태 (failed_count가 증가하면 WAL 회수 차단)
select archived_count, failed_count, last_failed_wal, last_failed_time,
       last_archived_wal, last_archived_time
from pg_stat_archiver;

-- [4] replication slot (비활성 슬롯이 WAL을 붙잡는지)
select slot_name, plugin, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as retained_wal
from pg_replication_slots;

-- [5] 활성 세션 / 장시간 트랜잭션
select pid, backend_type, state,
       age(clock_timestamp(), xact_start)  as xact_age,
       age(clock_timestamp(), query_start) as running_for,
       left(query, 120) as query
from pg_stat_activity
where state <> 'idle'
order by xact_start nulls last;

-- [6] idle in transaction 탐지 (체크포인트/vacuum 차단 원인)
select pid, age(clock_timestamp(), state_change) as idle_for, left(query,120)
from pg_stat_activity
where state = 'idle in transaction'
order by state_change;

-- [7] 진행 중 vacuum
select p.relid::regclass as tbl, p.phase,
       pg_size_pretty(p.heap_blks_total * 8192::bigint) as total,
       round(100.0 * p.heap_blks_scanned / nullif(p.heap_blks_total,0), 1) as pct
from pg_stat_progress_vacuum p;

-- [8] 테이블 용량 상위
select schemaname, relname,
       pg_size_pretty(pg_total_relation_size(relid)) as total,
       pg_size_pretty(pg_relation_size(relid))       as heap,
       pg_size_pretty(pg_indexes_size(relid))        as idx
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc
limit 15;

-- [9] 캐시 히트율 (RAM 부족 판단, 0.99 미만이면 메모리 압박)
select sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read),0) as cache_hit_ratio
from pg_statio_user_tables;

-- [10] 순차 스캔 과다 테이블 (인덱스 누락 후보)
select relname, seq_scan, seq_tup_read, idx_scan,
       seq_tup_read / nullif(seq_scan,0) as avg_rows_per_seq_scan
from pg_stat_user_tables
where seq_scan > 0
order by seq_tup_read desc
limit 15;

-- [11] 미사용 인덱스 (WAL 비용만 발생) — match_cache_ouids_idx 확인 기대
select schemaname, relname, indexrelname, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes
where idx_scan = 0
order by pg_relation_size(indexrelid) desc;

-- [12] 비용 상위 쿼리 (CPU 크레딧 회복 후 실행; pg_stat_statements 필요)
select calls,
       round(total_exec_time::numeric/1000, 1) as total_sec,
       round(mean_exec_time::numeric, 1)       as mean_ms,
       round((100 * total_exec_time / sum(total_exec_time) over ())::numeric, 1) as pct,
       left(query, 140) as query
from pg_stat_statements
order by total_exec_time desc
limit 20;

-- [13] pg_cron 잡 (등록한 경우; 현재 앱은 Vercel Cron 사용 — 미등록 예상)
-- select jobid, jobname, schedule, active, left(command, 100) as command from cron.job;
-- 배치 중단이 필요하면: update cron.job set active = false where jobid = <id>;

-- [14] 체크포인트 통계 (requested가 timed보다 크면 max_wal_size 부족 신호)
select * from pg_stat_checkpointer;
