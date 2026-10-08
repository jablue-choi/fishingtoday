-- 낚시금지구역 (국립해양조사원 전자해도 제한구역, Shapefile → scripts/import-ban-zones.mjs)
--  - 해상 제한구역 위주. 지자체 낚시통제구역(방파제 등)은 포함되지 않음
--  - 기록 화면에서 핀 위치가 구역 안이면 경고 (안내용)
create table if not exists public.fishing_ban_zones (
  id           serial primary key,
  source       text not null default 'khoa_enc',
  external_id  text not null,
  name         text,
  geom         geography(multipolygon, 4326) not null,
  info         jsonb,
  published_on date,
  unique (source, external_id)
);
create index if not exists fishing_ban_zones_geom_idx on public.fishing_ban_zones using gist (geom);

alter table public.fishing_ban_zones enable row level security;
create policy "ban_zones_select_auth" on public.fishing_ban_zones for select to authenticated using (true);
revoke all on public.fishing_ban_zones from anon;

-- 위치가 금지구역 안(또는 p_m 미터 이내)인지
create or replace function public.ban_zones_at(p_lat double precision, p_lon double precision, p_m double precision default 0)
returns table (id int, name text, dist_m double precision)
language sql stable as $$
  select z.id, z.name, st_distance(z.geom, st_makepoint(p_lon, p_lat)::geography)
  from public.fishing_ban_zones z
  where st_dwithin(z.geom, st_makepoint(p_lon, p_lat)::geography, p_m)
  order by 3
$$;
revoke all on function public.ban_zones_at(double precision, double precision, double precision) from public, anon;
grant execute on function public.ban_zones_at(double precision, double precision, double precision) to authenticated;

-- 적재용 (service_role만): 링들을 MULTILINESTRING으로 받아 PostGIS가 외곽·구멍을 조립
create or replace function public.import_ban_zone(
  p_source text, p_external_id text, p_name text, p_rings_wkt text, p_info jsonb, p_published_on date
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  g geometry := st_multi(st_buildarea(st_geomfromtext(p_rings_wkt, 4326)));
begin
  if g is null or st_isempty(g) then return false; end if;   -- 면적 없는 도형은 건너뜀
  insert into public.fishing_ban_zones (source, external_id, name, geom, info, published_on)
  values (p_source, p_external_id, nullif(p_name, ''), g::geography, p_info, p_published_on)
  on conflict (source, external_id) do update
    set name = excluded.name, geom = excluded.geom, info = excluded.info, published_on = excluded.published_on;
  return true;
end $$;
revoke all on function public.import_ban_zone(text, text, text, text, jsonb, date) from public, anon, authenticated;
grant execute on function public.import_ban_zone(text, text, text, text, jsonb, date) to service_role;
