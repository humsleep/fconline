-- 0015: 재방문 트리거 — (A) 개인 전적 스냅샷 누적 (B) 스쿼드 로그인 계정 연동
-- 회의 P0: "왔을 때 깊지만 내일 또 올 이유가 약함" → 개인 축적 + '지난 방문 대비' delta.

-- (A) 본인이 자기 전적을 볼 때 하루 1행 스냅샷 → /me·홈에서 변화 추적
create table if not exists user_snapshots (
  user_id       uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  win_rate      int not null,
  avg_rating    numeric(4,2) not null,
  played        int not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);

alter table user_snapshots enable row level security;

-- 본인만 읽기 (쓰기는 서버 service_role 경유 — 통계 위·변조 방지)
drop policy if exists user_snapshots_read on user_snapshots;
create policy user_snapshots_read on user_snapshots
  for select using (auth.uid() = user_id);

-- (B) 스쿼드 로그인 연동 — 로그인 상태로 저장하면 계정에 귀속(크로스기기·lock-in)
alter table squads add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists squads_user_idx on squads (user_id, created_at desc);
