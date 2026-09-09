-- 0018: iOS 푸시 디바이스 토큰 — 주간 리캡·메타 요약·내 글 댓글 알림용.
-- service_role 전용(RLS on, 정책 없음). 토큰은 앱이 /api/v1/devices 로 등록·갱신.
create table if not exists device_tokens (
  token        text primary key,
  platform     text not null default 'ios',
  user_id      uuid references auth.users (id) on delete cascade,   -- 로그인 시 연결(댓글 알림)
  nickname     text,                                                -- 기기의 '내 구단' (주간 리캡 대상)
  favorites    text[] not null default '{}',
  app_version  text,
  weekly_opt   boolean not null default true,
  meta_opt     boolean not null default true,
  last_seen    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on device_tokens (user_id);
create index if not exists device_tokens_nick_idx on device_tokens (lower(nickname));
alter table device_tokens enable row level security;
