-- 지역명(역지오코딩 결과)과 샘플 데이터 표시
alter table public.catch_logs add column if not exists region text;      -- '경기 안산시 단원구 대부동동'
alter table public.catch_logs add column if not exists is_sample boolean not null default false;
create index if not exists catch_logs_region_idx on public.catch_logs (region);

-- 다른 사람 기록 검색용 공개 뷰
--  - visibility가 radius/public 인 기록만
--  - 좌표는 약 500m 격자로 반올림 (정확한 포인트 비노출)
--  - security_invoker: 호출자 권한 → catch_logs RLS 적용
create or replace view public.public_catch_v
with (security_invoker = true) as
select
  c.id, c.caught_at, c.log_type, c.region, c.is_sample,
  s.name_ko as species_name, c.size_cm, c.count,
  m.label as method_label, b.label as bait_label,
  c.weather, c.temp_c, c.wind_ms, c.tide_mul,
  p.nickname,
  round(st_y(c.geom::geometry)::numeric / 0.005) * 0.005 as lat,
  round(st_x(c.geom::geometry)::numeric / 0.005) * 0.005 as lon
from public.catch_logs c
join public.profiles p          on p.id = c.user_id
left join public.species s      on s.id = c.species_id
left join public.method_codes m on m.code = c.method_code
left join public.bait_codes b   on b.code = c.bait_code
where c.visibility in ('radius','public');

grant select on public.public_catch_v to authenticated;

-- 내 기록 뷰에도 region 추가
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
  st_x(c.geom::geometry) as lon,
  c.region
from public.catch_logs c
left join public.species s      on s.id = c.species_id
left join public.method_codes m on m.code = c.method_code
left join public.bait_codes b   on b.code = c.bait_code;

-- 어종 마스터 보강 (샘플·실사용 공통)
insert into public.species (name_ko, name_std, difficulty, water_type) values
  ('주꾸미','주꾸미',1,'sea'),('갑오징어','참갑오징어',2,'sea'),('무늬오징어','흰오징어',4,'sea'),
  ('노래미','노래미',1,'sea'),('볼락','볼락',2,'sea'),('고등어','고등어',1,'sea'),
  ('전갱이','전갱이',1,'sea'),('학꽁치','학공치',2,'sea'),('농어','농어',4,'sea'),('벵에돔','벵에돔',4,'sea')
on conflict (name_ko) do nothing;
