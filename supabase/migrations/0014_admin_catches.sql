-- 관리자 조과 등록
--  - admins 테이블에 있는 사용자만 admin_add_catch()로 등록 (출처 필수)
--  - entered_by='admin' 기록은 화면에 '관리자 등록' + 출처 표시, 포인트 없음
--  - 일반 사용자는 entered_by·출처 컬럼을 쓸 수 없음 (RLS with check)

create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;            -- 정책 없음: 클라이언트 접근 불가
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.catch_logs add column if not exists entered_by  text not null default 'user';
alter table public.catch_logs add column if not exists source_type text;   -- boat 선사 / shop 낚시점 / admin_check 직접 확인 / public_data 공공데이터 / partner 제휴 / etc
alter table public.catch_logs add column if not exists source_name text;   -- '○○호', '○○낚시' 등
alter table public.catch_logs add column if not exists source_url  text;
alter table public.catch_logs drop constraint if exists catch_logs_entered_by_chk;
alter table public.catch_logs add constraint catch_logs_entered_by_chk check (
  entered_by in ('user', 'admin')
  and (source_type is null or source_type in ('boat', 'shop', 'admin_check', 'public_data', 'partner', 'etc'))
  and (entered_by = 'user' or source_type is not null)
);

-- 사용자는 관리자 기록·출처를 만들거나 바꿀 수 없음
drop policy if exists "catch_insert_own" on public.catch_logs;
create policy "catch_insert_own" on public.catch_logs for insert
  with check (auth.uid() = user_id and entered_by = 'user' and source_type is null);
drop policy if exists "catch_update_own" on public.catch_logs;
create policy "catch_update_own" on public.catch_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and entered_by = 'user' and source_type is null);

create or replace function public.admin_add_catch(
  p_caught_at timestamptz, p_lat double precision, p_lon double precision, p_region text,
  p_log_type text, p_species_id int, p_size_cm numeric, p_count int, p_method_code text, p_bait_code text,
  p_weather text, p_temp_c numeric, p_wind_dir text, p_wind_ms numeric, p_tide_mul smallint,
  p_source_type text, p_source_name text, p_source_url text, p_memo text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception '관리자만 등록할 수 있어요' using errcode = '42501'; end if;
  if p_source_type is null then raise exception '출처를 골라 주세요' using errcode = '22023'; end if;
  if p_caught_at > now() + interval '10 minutes' then raise exception '미래 시각은 등록할 수 없어요' using errcode = '22023'; end if;
  insert into public.catch_logs (
    user_id, geom, caught_at, region, log_type, species_id, size_cm, count, method_code, bait_code,
    weather, temp_c, wind_dir, wind_ms, tide_mul, auto_filled, visibility, memo,
    entered_by, source_type, source_name, source_url
  ) values (
    auth.uid(), st_makepoint(p_lon, p_lat)::geography, p_caught_at, p_region, coalesce(p_log_type, 'catch'),
    p_species_id, p_size_cm, coalesce(p_count, 1), nullif(p_method_code, ''), nullif(p_bait_code, ''),
    p_weather, p_temp_c, p_wind_dir, p_wind_ms, p_tide_mul, p_weather is not null, 'public', nullif(p_memo, ''),
    'admin', p_source_type, nullif(btrim(p_source_name), ''), nullif(btrim(p_source_url), '')
  ) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.admin_add_catch(timestamptz, double precision, double precision, text, text, int, numeric, int, text, text, text, numeric, text, numeric, smallint, text, text, text, text) from public, anon;
grant execute on function public.admin_add_catch(timestamptz, double precision, double precision, text, text, int, numeric, int, text, text, text, numeric, text, numeric, smallint, text, text, text, text) to authenticated;

-- 공개 뷰: 관리자 등록 여부·출처 추가 (소유자 권한 유지, 좌표 500m 반올림 유지)
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
  c.entered_by, c.source_type, c.source_name, c.source_url
from public.catch_logs c
join public.profiles p          on p.id = c.user_id
left join public.species s      on s.id = c.species_id
left join public.method_codes m on m.code = c.method_code
left join public.bait_codes b   on b.code = c.bait_code
where c.visibility in ('radius','public');

-- 내 기록 뷰: 관리자가 등록한 기록은 '내 기록'에서 구분할 수 있게
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
  c.entered_by, c.source_type, c.source_name, c.source_url
from public.catch_logs c
left join public.species s      on s.id = c.species_id
left join public.method_codes m on m.code = c.method_code
left join public.bait_codes b   on b.code = c.bait_code;
