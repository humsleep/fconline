-- 0022: squads 공개 SELECT 정책 제거 — anon REST 로 ip_hash·user_id 가 읽히던 문제(2026-09 출시 전 감사).
--
-- squads_read(0003, using (true)) 는 누구나 PostgREST 로 모든 스쿼드의 ip_hash(0008)·user_id(0015) 를 읽게 한다
-- → 같은 IP 에서 만든 익명 스쿼드끼리, 또는 스쿼드와 계정을 연결할 수 있다.
-- 서버는 스쿼드를 service_role 로만 읽는다(lib/squad/store.ts). 마지막 유저 세션 읽기였던
-- /api/profile GET '내 스쿼드' 목록도 같은 배포에서 service_role 로 옮겼다.
--
-- ⚠️ 배포 순서: 코드 배포(/api/profile 이 getAdmin 으로 squads 를 읽는 커밋) **후에** 실행.
--    먼저 실행하면 구 코드의 마이페이지 '내 스쿼드' 목록이 비어 보인다(오류는 아님).
-- RLS 는 켜진 채로 두고 정책만 지운다 → anon/authenticated 는 0행, service_role 은 RLS 우회로 그대로.

drop policy if exists squads_read on public.squads;
