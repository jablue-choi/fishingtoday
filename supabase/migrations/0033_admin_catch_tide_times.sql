-- 관리자 조과 등록에도 만조·간조(high_tide_at / low_tide_at) 스냅샷 저장
-- 새 인자는 기본값 null → 예전 클라이언트 호출도 그대로 동작. 나머지는 0014와 같음

drop function if exists public.admin_add_catch(timestamptz, double precision, double precision, text, text, int, numeric, int, text, text, text, numeric, text, numeric, smallint, text, text, text, text);

create or replace function public.admin_add_catch(
  p_caught_at timestamptz, p_lat double precision, p_lon double precision, p_region text,
  p_log_type text, p_species_id int, p_size_cm numeric, p_count int, p_method_code text, p_bait_code text,
  p_weather text, p_temp_c numeric, p_wind_dir text, p_wind_ms numeric, p_tide_mul smallint,
  p_source_type text, p_source_name text, p_source_url text, p_memo text,
  p_high_tide_at time default null, p_low_tide_at time default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception '관리자만 등록할 수 있어요' using errcode = '42501'; end if;
  if p_source_type is null then raise exception '출처를 골라 주세요' using errcode = '22023'; end if;
  if p_caught_at > now() + interval '10 minutes' then raise exception '미래 시각은 등록할 수 없어요' using errcode = '22023'; end if;
  insert into public.catch_logs (
    user_id, geom, caught_at, region, log_type, species_id, size_cm, count, method_code, bait_code,
    weather, temp_c, wind_dir, wind_ms, tide_mul, high_tide_at, low_tide_at, auto_filled, visibility, memo,
    entered_by, source_type, source_name, source_url
  ) values (
    auth.uid(), st_makepoint(p_lon, p_lat)::geography, p_caught_at, p_region, coalesce(p_log_type, 'catch'),
    p_species_id, p_size_cm, coalesce(p_count, 1), nullif(p_method_code, ''), nullif(p_bait_code, ''),
    p_weather, p_temp_c, p_wind_dir, p_wind_ms, p_tide_mul, p_high_tide_at, p_low_tide_at, p_weather is not null, 'public', nullif(p_memo, ''),
    'admin', p_source_type, nullif(btrim(p_source_name), ''), nullif(btrim(p_source_url), '')
  ) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.admin_add_catch(timestamptz, double precision, double precision, text, text, int, numeric, int, text, text, text, numeric, text, numeric, smallint, text, text, text, text, time, time) from public, anon;
grant execute on function public.admin_add_catch(timestamptz, double precision, double precision, text, text, int, numeric, int, text, text, text, numeric, text, numeric, smallint, text, text, text, text, time, time) to authenticated;
