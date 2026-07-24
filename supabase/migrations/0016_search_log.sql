-- 0016_search_log.sql
-- 검색된 구단주명을 기록 → sitemap에 /user/[nickname] 색인용 (op.gg식 프로필 SEO 엔진).
-- service_role(admin)만 접근. RLS 활성 + 정책 없음 = 익명/일반 클라이언트 완전 차단.

create table if not exists public.search_log (
  nickname_lower text primary key,        -- 대소문자 무시 dedup 키
  nickname       text not null,            -- 표시용 원본 케이싱
  hits           integer not null default 1,
  last_seen      timestamptz not null default now()
);

-- sitemap이 최신 검색 순으로 뽑을 때 사용
create index if not exists search_log_last_seen_idx
  on public.search_log (last_seen desc);

alter table public.search_log enable row level security;
-- 정책을 만들지 않는다: service_role만 우회 접근(서버 라우트 전용). 클라이언트 노출 금지.
