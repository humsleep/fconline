-- 앱 사용 통계 — Supabase SQL Editor 에서 실행. env='appstore' 만 센다(개발·TestFlight 제외).

-- ① 일별 활성 기기 (최근 14일, KST)
select (created_at at time zone 'Asia/Seoul')::date as day, count(distinct install_id) as dau
from app_events where env = 'appstore' and created_at > now() - interval '14 days'
group by 1 order by 1 desc;

-- ② 재방문율 — 첫 방문일 기준 다음 날(D1)·7일 후(D7)에 다시 열었는가
with first_seen as (
  select install_id, min((created_at at time zone 'Asia/Seoul')::date) as d0
  from app_events where env = 'appstore' group by 1
), opens as (
  select distinct install_id, (created_at at time zone 'Asia/Seoul')::date as d
  from app_events where env = 'appstore' and event = 'app_open'
)
select f.d0 as cohort, count(*) as installs,
  round(100.0 * count(*) filter (where exists (select 1 from opens o where o.install_id = f.install_id and o.d = f.d0 + 1)) / count(*), 1) as d1_pct,
  round(100.0 * count(*) filter (where exists (select 1 from opens o where o.install_id = f.install_id and o.d = f.d0 + 7)) / count(*), 1) as d7_pct
from first_seen f where f.d0 > current_date - 30
group by 1 order by 1 desc;

-- ③ 어떤 카드가 실제로 공유되는가 (만들기 → 공유 전환율)
select props->>'type' as card,
  count(*) filter (where event = 'card_create') as created,
  count(*) filter (where event = 'card_share') as shared,
  count(*) filter (where event = 'card_share' and props->>'channel' = 'instagram') as instagram,
  round(100.0 * count(*) filter (where event = 'card_share') / nullif(count(*) filter (where event = 'card_create'), 0), 1) as share_pct
from app_events where env = 'appstore' and event in ('card_create', 'card_share') and created_at > now() - interval '30 days'
group by 1 order by shared desc;

-- ④ 검색과 전면 광고 — 광고 도입 후 검색이 줄었는가
select (created_at at time zone 'Asia/Seoul')::date as day,
  count(*) filter (where event = 'search') as searches,
  count(*) filter (where event = 'interstitial' and props->>'result' = 'shown') as ads_shown,
  round(1.0 * count(*) filter (where event = 'search') / nullif(count(distinct install_id), 0), 2) as searches_per_device
from app_events where env = 'appstore' and created_at > now() - interval '30 days'
group by 1 order by 1 desc;

-- ⑤ 전적 화면에서 어떤 보기를 쓰는가
select props->>'section' as section, count(*) as views, count(distinct install_id) as devices
from app_events where env = 'appstore' and event = 'section_view' and created_at > now() - interval '30 days'
group by 1 order by views desc;
