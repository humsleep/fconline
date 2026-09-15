-- 0021: 컬럼 단위 쓰기 권한 — RLS 는 "어느 행"만 막고 "어느 컬럼"은 막지 못한다.
--
-- 문제(2026-09 출시 전 감사):
--   · community_posts_update(0006) 는 작성자에게 행 전체 UPDATE 를 허용한다 →
--     PostgREST 로 created_at 을 과거로 바꾸면 0013 의 "30초에 1건" 간격 제한이 무력화되고,
--     comment_count·type 도 임의로 바꿀 수 있다. INSERT 도 같다(created_at 을 과거로 넣으면 다음 글이 통과).
--   · community_comments 도 INSERT 로 created_at 을 넣어 "10초에 1건"을 우회할 수 있다.
--   · profiles_update_own(0004) 은 verified_nickname·verified_ouid·verified_at·consented_at 을
--     본인이 직접 쓸 수 있게 한다 → 넥슨 조회 검증 없이 구단주명 연동을 사칭할 수 있다.
--
-- 해결: authenticated/anon 의 테이블 단위 INSERT·UPDATE 를 회수하고, 서버 라우트가 유저 세션으로
-- 실제로 쓰는 컬럼만 컬럼 단위로 다시 준다(2026-09-15 코드 전수 확인).
--   · POST  /api/community/posts               insert (id, author_id, type, title, body, region, positions, contact, squad_id, meta, status)
--   · PATCH /api/community/posts/[id]          update (status) / (title, body, region, positions, contact, squad_id, meta)
--   · POST  /api/community/posts/[id]/comments insert (id, post_id, author_id, body, squad_id)
--   · POST  /api/profile                       upsert (id, nickname)  ← ON CONFLICT DO UPDATE 가 id 도 SET 하므로 id 포함
--   · consented_at·verified_* 쓰기는 같은 배포에서 service_role(getAdmin)로 옮겼다 → 컬럼을 주지 않는다.
-- service_role 은 별도 역할이라 영향 없음. 트리거(set_updated_at·bump_comment_count(security definer)·
-- auto_hide_on_reports·protect_hidden_column)는 NEW 값을 바꾸는 것이라 컬럼 권한 검사 대상이 아니다.
--
-- ⚠️ 배포 순서: 이 마이그레이션은 **코드 배포(consented_at·verified_* 를 admin 으로 옮긴 커밋) 후에** 실행.
--    먼저 실행하면 구 코드의 약관 동의 시각 기록·구단주명 연동이 권한 오류(42501)로 실패한다.
-- ⚠️ 새 컬럼을 유저 세션으로 쓰는 코드를 추가하면 여기에 grant 를 추가해야 한다(안 하면 42501).
--
-- 재실행 안전: revoke/grant 는 멱등, 제약은 drop if exists 후 추가. 한 트랜잭션으로 묶어
-- 중간 실패 시 "회수만 되고 재부여는 안 된" 상태(글쓰기 전면 불가)가 남지 않게 한다.

begin;

-- ─────────────────────────────────────────────────────────────
-- community_posts
-- ─────────────────────────────────────────────────────────────
revoke insert, update on public.community_posts from anon, authenticated;

grant insert (id, author_id, type, title, body, region, positions, contact, squad_id, meta, status)
  on public.community_posts to authenticated;

grant update (title, body, region, positions, contact, squad_id, meta, status)
  on public.community_posts to authenticated;

-- ─────────────────────────────────────────────────────────────
-- community_comments (UPDATE 정책이 없어 RLS 로 이미 막히지만 권한도 맞춰 둔다)
-- ─────────────────────────────────────────────────────────────
revoke insert, update on public.community_comments from anon, authenticated;

grant insert (id, post_id, author_id, body, squad_id)
  on public.community_comments to authenticated;

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
revoke insert, update on public.profiles from anon, authenticated;

grant insert (id, nickname) on public.profiles to authenticated;
-- id 는 RLS(using/with check auth.uid() = id)로 자기 값 외에는 못 바꾼다 — upsert 가 SET 하므로 필요.
grant update (id, nickname) on public.profiles to authenticated;

-- 닉네임 길이(validateNickname: 2~16자, trim 후 저장).
-- NOT VALID: 기존 행은 검사하지 않고 새로 쓰는 행부터 강제한다.
-- ⚠️ CHECK 는 해당 행의 "모든" UPDATE 에 적용된다 — 범위를 벗어난 옛 닉네임을 가진 사용자는
--    구단주명 연동·동의 시각 기록도 실패한다. 실행 전 아래가 0 인지 확인하고, 0 이면 맨 아래 validate 까지 실행:
--      select count(*) from public.profiles where char_length(nickname) not between 2 and 16;
alter table public.profiles drop constraint if exists profiles_nickname_len;
alter table public.profiles
  add constraint profiles_nickname_len check (char_length(nickname) between 2 and 16) not valid;

commit;

-- PostgREST 는 권한을 쿼리 시점에 Postgres 에서 확인하므로 스키마 리로드는 필수는 아니다(무해).
notify pgrst, 'reload schema';

-- (선택) 위 count 가 0 이면 기존 행까지 검증 완료로 표시:
--   alter table public.profiles validate constraint profiles_nickname_len;

-- ─────────────────────────────────────────────────────────────
-- 의도적으로 하지 않은 것: squads_read(0003, using (true)) 제거.
-- /api/profile GET(마이페이지 '내 스쿼드')이 유저 세션 클라이언트로 squads 를 읽는다
-- (app/api/profile/route.ts). 정책을 지우면 그 목록이 빈다. 그 읽기를 service_role 로 옮긴 뒤
-- 별도 마이그레이션에서 drop policy squads_read 할 것(anon REST 로 ip_hash·user_id 노출 해소).
-- ─────────────────────────────────────────────────────────────
