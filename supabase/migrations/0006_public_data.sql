-- 공공데이터 연동
-- 1) spots: 공공데이터에서 가져온 포인트 구분용 컬럼
alter table public.spots add column if not exists source      text;   -- 'mof_rock' 갯바위, 'mof_boat' 선상, 'mois_ground' 낚시터
alter table public.spots add column if not exists external_id text;
alter table public.spots add column if not exists region      text;
alter table public.spots add column if not exists species_text text;  -- '감성돔, 벵에돔'
alter table public.spots add column if not exists info        jsonb;  -- 수심, 물때, 이용요금 등 원본 부가정보
create unique index if not exists spots_source_ext_idx on public.spots (source, external_id);

-- 2) 바다낚시지수 캐시 (API 호출량 절약, 3시간 유효)
create table if not exists public.fishing_index_cache (
  gubun      text primary key,          -- '갯바위' | '선상'
  fetched_at timestamptz not null,
  items      jsonb not null             -- 정규화된 지수 목록
);
alter table public.fishing_index_cache enable row level security;  -- 엣지 함수(service_role)만 읽고 씀

-- 3) 반경 내 포인트 조회 (홈·검색에서 사용)
create or replace function public.spots_near(p_lat double precision, p_lon double precision, p_km double precision default 20, p_limit int default 30)
returns table (id uuid, name text, spot_type text, source text, region text, species_text text, lat double precision, lon double precision, dist_km double precision)
language sql stable as $$
  select s.id, s.name, s.spot_type, s.source, s.region, s.species_text,
         st_y(s.geom::geometry), st_x(s.geom::geometry),
         st_distance(s.geom, st_makepoint(p_lon, p_lat)::geography) / 1000.0
  from public.spots s
  where st_dwithin(s.geom, st_makepoint(p_lon, p_lat)::geography, p_km * 1000)
  order by s.geom <-> st_makepoint(p_lon, p_lat)::geography
  limit p_limit
$$;
grant execute on function public.spots_near to authenticated;
