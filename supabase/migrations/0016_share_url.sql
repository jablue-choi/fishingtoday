-- 자랑하기: 내 조과 기록에 내가 쓴 블로그·카페·SNS 글 링크를 붙임
--  - 남에게 보이는 링크라 피싱 방지를 위해 주요 도메인만 허용 (https, 500자 이내)
--  - 링크만 저장. 글 내용을 가져오지 않음(크롤링 아님)

create or replace function public.is_allowed_share_url(u text)
returns boolean language sql immutable as $$
  select u is not null and length(u) <= 500 and u ~* (
    '^https://([a-z0-9-]+\.)*(' ||
    'blog\.naver\.com|cafe\.naver\.com|naver\.me|tistory\.com|cafe\.daum\.net|blog\.daum\.net|' ||
    'brunch\.co\.kr|velog\.io|instagram\.com|youtube\.com|youtu\.be|band\.us|threads\.net|threads\.com' ||
    ')(/|$|\?)'
  )
$$;

alter table public.catch_logs add column if not exists share_url text;
alter table public.catch_logs drop constraint if exists catch_logs_share_url_chk;
alter table public.catch_logs add constraint catch_logs_share_url_chk check (share_url is null or public.is_allowed_share_url(share_url));

-- 공개 뷰·내 기록 뷰에 share_url 추가 (나머지는 0014와 같음)
create or replace view public.public_catch_v
with (security_invoker = false) as
select
  c.id, c.caught_at, c.log_type, c.region, c.is_sample,
  s.name_ko as species_name, c.size_cm, c.count,
  m.label as method_label, b.label as bait_label,
  c.weather, c.temp_c, c.wind_ms, c.tide_mul,
  p.nickname,
  round(st_y(c.geom::geometry)::numeric / 0.005) * 0.005 as lat,
  round(st_x(c.geom::geometry)::numeric / 0.005) * 0.005 as lon,
  c.entered_by, c.source_type, c.source_name, c.source_url,
  c.share_url
from public.catch_logs c
join public.profiles p          on p.id = c.user_id
left join public.species s      on s.id = c.species_id
left join public.method_codes m on m.code = c.method_code
left join public.bait_codes b   on b.code = c.bait_code
where c.visibility in ('radius','public');

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
  c.region,
  c.entered_by, c.source_type, c.source_name, c.source_url,
  c.share_url
from public.catch_logs c
left join public.species s      on s.id = c.species_id
left join public.method_codes m on m.code = c.method_code
left join public.bait_codes b   on b.code = c.bait_code;
