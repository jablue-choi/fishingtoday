-- 어종 코드 + 사용자 어종 추가 + 마스터 테이블 쓰기 차단
--  1) species에 code(영문 슬러그) 추가. 그림(FishArt)·연동은 code 기준
--  2) 목록에 없는 어종은 add_species()로 정식 행(status='user', code='u<id>')을 만들어 species_id로 저장
--  3) 마스터 테이블은 RLS 켜고 읽기만 허용 (그동안 로그인 사용자가 수정 가능한 상태였음)

alter table public.species add column if not exists code       text;
alter table public.species add column if not exists status     text not null default 'official';
alter table public.species add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.species add column if not exists created_at timestamptz not null default now();
alter table public.species drop constraint if exists species_status_chk;
alter table public.species add constraint species_status_chk check (status in ('official', 'user'));

update public.species s set code = v.code
from (values
  ('우럭','korean_rockfish'), ('광어','olive_flounder'), ('감성돔','black_porgy'), ('망둥어','goby'),
  ('참돔','red_seabream'), ('삼치','spanish_mackerel'), ('붕어','crucian_carp'), ('배스','largemouth_bass'),
  ('주꾸미','webfoot_octopus'), ('갑오징어','cuttlefish'), ('무늬오징어','bigfin_reef_squid'), ('노래미','greenling'),
  ('볼락','darkbanded_rockfish'), ('고등어','chub_mackerel'), ('전갱이','horse_mackerel'), ('학꽁치','halfbeak'),
  ('농어','sea_bass'), ('벵에돔','opaleye'), ('대구','pacific_cod'), ('살오징어','common_squid'),
  ('참문어','common_octopus'), ('쥐노래미','fat_greenling'), ('돌돔','striped_beakperch'), ('쏘가리','mandarin_fish')
) as v(name, code)
where s.name_ko = v.name and s.code is null;
update public.species set code = 'u' || id where code is null;
alter table public.species alter column code set not null;
create unique index if not exists species_code_uidx on public.species (code);
create unique index if not exists species_name_norm_uidx on public.species (replace(name_ko, ' ', ''));

-- 사용자 어종 추가: 같은 이름(띄어쓰기 무시)이 있으면 그걸 돌려줌. 하루 10개 제한
create or replace function public.add_species(p_name text, p_water text default 'sea')
returns table (id int, name_ko text, code text, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v text := regexp_replace(btrim(p_name), '\s+', ' ', 'g');
  v_id int;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if v !~ '^[가-힣A-Za-z ]{1,20}$' then raise exception '어종 이름은 20자 이내 한글·영문으로 적어 주세요' using errcode = '22023'; end if;
  if p_water not in ('sea', 'fresh', 'both') then p_water := 'sea'; end if;

  select s.id into v_id from public.species s where replace(s.name_ko, ' ', '') = replace(v, ' ', '');
  if v_id is null then
    if (select count(*) from public.species s where s.created_by = auth.uid() and s.created_at > now() - interval '1 day') >= 10 then
      raise exception '오늘은 어종을 더 추가할 수 없어요' using errcode = '54000';
    end if;
    insert into public.species (name_ko, difficulty, water_type, code, status, created_by)
    values (v, 1, p_water, 'tmp_' || gen_random_uuid(), 'user', auth.uid())
    returning species.id into v_id;
    update public.species set code = 'u' || v_id where species.id = v_id;
  end if;
  return query select s.id, s.name_ko, s.code, s.status from public.species s where s.id = v_id;
end $$;
revoke all on function public.add_species(text, text) from public, anon;
grant execute on function public.add_species(text, text) to authenticated;

-- 마스터 테이블: 읽기만
do $$
declare t text;
begin
  foreach t in array array['species','method_codes','bait_codes','closed_season_rules','spots','facilities','species_seasons','point_rules','badges'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
