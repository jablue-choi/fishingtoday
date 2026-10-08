-- 내 기록 리포트·히스토리 지도용 뷰
-- geography는 PostgREST에서 WKB로 내려오므로 lat/lon 숫자로 풀어서 제공.
-- security_invoker: 호출자 권한으로 실행 → catch_logs RLS 그대로 적용.
create or replace view public.catch_logs_v
with (security_invoker = true) as
select
  c.id, c.user_id, c.spot_id, c.caught_at, c.log_type,
  c.species_id, s.name_ko as species_name, c.size_cm, c.count,
  c.method_code, m.label as method_label,
  c.bait_code,   b.label as bait_label,
  c.weather, c.temp_c, c.wind_dir, c.wind_ms, c.tide_mul,
  c.visibility, c.verified,
  st_y(c.geom::geometry) as lat,
  st_x(c.geom::geometry) as lon
from public.catch_logs c
left join public.species s      on s.id = c.species_id
left join public.method_codes m on m.code = c.method_code
left join public.bait_codes b   on b.code = c.bait_code;

grant select on public.catch_logs_v to authenticated;
