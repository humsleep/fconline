-- 0013: 라이브 오픈 하드닝 — (A) 커뮤니티 작성 간격 제한 (B) 넥슨 kill-switch 플래그
-- 회의 5라운드 결과의 오픈 게이트 중 DB 계층 항목.

-- ─────────────────────────────────────────────────────────────
-- (A) 커뮤니티 작성 간격 제한 (스팸 도배 방어)
-- 커뮤니티는 유저 세션(anon key) + RLS insert 경로라, squads(0008, service_role 카운트)
-- 패턴을 그대로 못 쓴다. INSERT WITH CHECK에 not-exists 시간창 sub-select을 추가한다.
-- 신규 유저의 첫 글/댓글은 prev 행이 없어 통과된다(검증됨).
-- ─────────────────────────────────────────────────────────────

-- 간격 검사 sub-select이 매 insert마다 스캔하지 않도록 복합 인덱스
create index if not exists community_posts_author_created_idx
  on community_posts (author_id, created_at desc);
create index if not exists community_comments_author_created_idx
  on community_comments (author_id, created_at desc);

-- 글: 30초에 1건
drop policy if exists community_posts_insert on community_posts;
create policy community_posts_insert on community_posts
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.nickname is not null
        and length(trim(p.nickname)) > 0
    )
    and not exists (
      select 1 from community_posts prev
      where prev.author_id = auth.uid()
        and prev.created_at > now() - interval '30 seconds'
    )
  );

-- 댓글: 10초에 1건
drop policy if exists community_comments_insert on community_comments;
create policy community_comments_insert on community_comments
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.nickname is not null
        and length(trim(p.nickname)) > 0
    )
    and not exists (
      select 1 from community_comments prev
      where prev.author_id = auth.uid()
        and prev.created_at > now() - interval '10 seconds'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- (B) 넥슨 kill-switch 플래그 (service_flags)
-- 운영자가 배포 없이 /admin에서 넥슨 팬아웃을 즉시 정지/재개할 수 있는 스위치.
-- 읽기: 서버(service_role)만. 클라이언트 노출 불필요 → 정책 없음(RLS on = service_role 전용).
-- ─────────────────────────────────────────────────────────────

create table if not exists service_flags (
  key         text primary key,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table service_flags enable row level security;
-- 정책 없음: anon/authenticated 접근 불가, service_role만 읽기/쓰기.

-- 기본 플래그 행(넥슨 일시정지) 시드 — 없으면 만들고, 있으면 유지
insert into service_flags (key, enabled)
values ('nexon_paused', false)
on conflict (key) do nothing;
