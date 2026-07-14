-- 0014: 스쿼드 배틀 투표 유형 추가.
-- community_posts.type CHECK에 'squad_battle' 허용. 두 번째 스쿼드는 meta.squad_b(jsonb)에 저장.
-- 투표는 기존 vs_votes 테이블(익명 voter, service_role) 재활용 — 별도 테이블 불필요.

alter table community_posts drop constraint if exists community_posts_type_chk;
alter table community_posts add constraint community_posts_type_chk check (type in (
  'squad_show','squad_rate','squad_make','club_recruit','club_match','tournament','squad_battle'
));
