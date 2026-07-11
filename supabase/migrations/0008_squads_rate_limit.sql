-- 0008: 스쿼드 저장 어뷰징 방지 — IP 해시 컬럼 + 일일 카운트 조회 인덱스
-- (저장은 service_role 경유라 RLS 대신 서버 코드에서 한도 검사)

alter table squads add column if not exists ip_hash text;

create index if not exists squads_iphash_created_idx
  on squads (ip_hash, created_at desc);
