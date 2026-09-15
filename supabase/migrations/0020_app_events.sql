-- 0020: 앱 익명 사용 기록 — "무엇이 공유되고, 누가 돌아오는가"를 알기 위한 최소 측정.
--
-- 계정·닉네임·IDFA·IDFV 를 담지 않는다. 설치 때 앱이 만든 무작위 UUID(install_id) 하나로만
-- 같은 기기의 재방문을 묶는다(앱 삭제 시 새 UUID). service_role 전용(RLS on, 정책 없음).
--
-- 쓰기 증폭 주의(과거 WAL·Disk IO 장애의 원인): 앱이 이벤트를 20개씩 모아 한 번에 보내므로
-- 행 수 대비 트랜잭션 수가 적다. 인덱스도 조회에 꼭 필요한 2개만 둔다.
-- 보관 180일 — ranker-snapshot 크론이 정리한다.
create table if not exists app_events (
  id          bigint generated always as identity primary key,
  install_id  uuid not null,
  event       text not null,
  props       jsonb not null default '{}',
  app_version text,
  env         text not null default 'unknown',   -- debug | testflight | appstore (통계는 appstore 만)
  created_at  timestamptz not null default now()
);
create index if not exists app_events_created_idx on app_events (created_at);
create index if not exists app_events_install_idx on app_events (install_id, created_at);
alter table app_events enable row level security;
