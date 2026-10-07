-- =========================================================
-- 낚시 기록·추천 앱  /  Supabase 초기 스키마  v0.1
-- 적용: supabase db push  또는  SQL Editor에 붙여넣기
-- =========================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1. 유저 프로필  (auth.users 1:1)
-- ---------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nickname      text not null,
  provider      text not null check (provider in ('kakao','naver')),
  pref_method   text[] default '{}',            -- 선호 낚시 방법 ['루어','찌']
  home_region   text,                           -- "경기 서해" 등 추천 거리 계산용
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', '조사' || left(new.id::text, 4)),
    coalesce(new.raw_app_meta_data->>'provider', 'kakao')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- 2. 마스터: 어종 / 금어기 규칙 / 낚시 방법·미끼 코드
-- ---------------------------------------------------------
create table public.species (
  id            serial primary key,
  name_ko       text not null unique,            -- 우럭
  name_std      text,                            -- 조피볼락 (표준명)
  difficulty    smallint not null default 1,     -- 스코어 가중치 1~5
  water_type    text not null check (water_type in ('sea','fresh','both'))
);

-- 금어기 · 금지체장 (해수부 고시 기준, 수동 관리)
create table public.closed_season_rules (
  id            serial primary key,
  species_id    int not null references public.species(id),
  rule_type     text not null check (rule_type in ('season','min_size')),
  start_mmdd    char(4),                         -- '0116'  (season일 때)
  end_mmdd      char(4),                         -- '0215'
  min_size_cm   numeric(5,1),                    -- 25.0    (min_size일 때)
  region        text,                            -- null = 전국
  law_ref       text,                            -- '수산자원관리법 시행령 별표'
  effective_from date not null default current_date,
  effective_to   date
);

create table public.method_codes (
  code  text primary key,                        -- 'lure','float','surf','boat','eging'
  label text not null                            -- '루어','찌','원투','선상','에깅'
);

create table public.bait_codes (
  code  text primary key,                        -- 'worm','krill','lugworm','metal_jig'
  label text not null
);

-- ---------------------------------------------------------
-- 3. 낚시 포인트(장소) / 편의시설
-- ---------------------------------------------------------
create table public.spots (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                   -- 영흥도 진두항 방파제
  geom          geography(point, 4326) not null,
  spot_type     text check (spot_type in ('breakwater','rock','beach','boat','reservoir','river')),
  tide_station  text,                            -- 조석 관측소 코드 (바다누리)
  weather_grid  text,                            -- 기상청 격자 nx,ny  "55,124"
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index spots_geom_idx on public.spots using gist (geom);

create table public.facilities (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('toilet','restaurant','store','tackle_shop','parking')),
  name          text not null,
  geom          geography(point, 4326) not null,
  open_hours    text,                            -- '24시간', '06:00-22:00'
  accessible    boolean,                         -- 장애인 화장실 여부
  source        text,                            -- 'kakao_local','manual'
  external_id   text,
  updated_at    timestamptz not null default now()
);
create index facilities_geom_idx on public.facilities using gist (geom);

-- ---------------------------------------------------------
-- 4. 출조 일정 (출조 전 저장 → 전날 알림)
-- ---------------------------------------------------------
create table public.trip_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  spot_id       uuid references public.spots(id),
  plan_date     date not null,
  notified_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 5. 조과 기록  (핵심 테이블)
-- ---------------------------------------------------------
create table public.catch_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  spot_id         uuid references public.spots(id),
  geom            geography(point, 4326) not null, -- 실제 찍은 위치 (spot과 별도)
  caught_at       timestamptz not null default now(),

  -- 기록 종류
  log_type        text not null default 'catch'
                  check (log_type in ('catch','release','zero')),   -- 조과 / 방생 / 꽝

  -- 체크값
  species_id      int references public.species(id),
  size_cm         numeric(5,1),
  count           smallint default 1,
  method_code     text references public.method_codes(code),
  bait_code       text references public.bait_codes(code),

  -- 자동 입력값 (현위치 찍을 때 스냅샷)
  weather         text,                           -- '맑음'
  temp_c          numeric(4,1),
  wind_dir        text,                           -- 'NW'
  wind_ms         numeric(4,1),
  tide_mul        smallint,                       -- 물때 1~15 (9물 = 9)
  high_tide_at    time,
  low_tide_at     time,
  water_temp_c    numeric(4,1),
  auto_filled     boolean not null default false, -- 오프라인 저장 후 보정 여부
  auto_corrected_at timestamptz,

  -- 공개 설정 / 인증 상태
  visibility      text not null default 'private'
                  check (visibility in ('private','radius','public')),
  verified        boolean not null default false, -- 사진 인증 통과
  memo            text,
  created_at      timestamptz not null default now()
);
create index catch_logs_user_idx  on public.catch_logs (user_id, caught_at desc);
create index catch_logs_spot_idx  on public.catch_logs (spot_id, caught_at desc);
create index catch_logs_geom_idx  on public.catch_logs using gist (geom);

-- 사진 (Supabase Storage 'catch-photos' 버킷 경로 참조)
create table public.catch_photos (
  id            uuid primary key default gen_random_uuid(),
  catch_log_id  uuid not null references public.catch_logs(id) on delete cascade,
  storage_path  text not null,                   -- user_id/catch_id/xxx.jpg
  sha256        text not null,                   -- 재사용 차단
  exif_taken_at timestamptz,
  exif_geom     geography(point, 4326),
  exif_ok       boolean,                         -- 시각·위치 검증 결과
  created_at    timestamptz not null default now()
);
create unique index catch_photos_sha_idx on public.catch_photos (sha256);

-- ---------------------------------------------------------
-- 6. 포인트 원장  (잔액 컬럼 없음 — 이력 합산)
-- ---------------------------------------------------------
create table public.point_ledger (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  amount        int  not null,                   -- +적립 / -사용(2차)
  reason        text not null
                check (reason in ('base_log','photo_verified','first_visit',
                                  'release','zero_log','daily_cap_adjust',
                                  'redeem','event_entry','admin')),
  ref_type      text,                            -- 'catch_log','redemption','event'
  ref_id        uuid,
  created_at    timestamptz not null default now()
);
create index point_ledger_user_idx on public.point_ledger (user_id, created_at desc);

-- 같은 기록에 같은 사유로 두 번 적립 방지
create unique index point_ledger_once_idx
  on public.point_ledger (user_id, reason, ref_id)
  where ref_id is not null and reason <> 'admin';

-- 잔액 뷰
create view public.point_balances as
  select user_id, coalesce(sum(amount),0)::int as balance
  from public.point_ledger group by user_id;

-- 적립 규칙 (코드가 아닌 테이블로 — 숫자 바꿀 때 배포 불필요)
create table public.point_rules (
  reason     text primary key,
  amount     int not null,
  daily_cap  int                                 -- null = 상한 없음(전체 상한은 아래 상수)
);
insert into public.point_rules values
  ('base_log',       20, null),
  ('photo_verified', 30, null),
  ('first_visit',    10, null),
  ('release',        30, null),
  ('zero_log',        5, null);

-- ---------------------------------------------------------
-- 7. 스코어 이벤트 (포인트와 분리 — 사용해도 안 줄어듦)
-- ---------------------------------------------------------
create table public.score_events (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  catch_log_id  uuid references public.catch_logs(id) on delete cascade,
  score         int not null,
  breakdown     jsonb,                           -- {"count":2,"size":18,"difficulty":8,"release":0}
  created_at    timestamptz not null default now()
);
create index score_events_user_idx on public.score_events (user_id, created_at desc);

create table public.badges (
  code   text primary key,                       -- 'rockfish_5','first_release','trips_10'
  label  text not null,
  rule   jsonb                                   -- 판정 조건 (앱/엣지함수에서 해석)
);
create table public.user_badges (
  user_id    uuid references public.profiles(id) on delete cascade,
  badge_code text references public.badges(code),
  earned_at  timestamptz not null default now(),
  primary key (user_id, badge_code)
);

-- ---------------------------------------------------------
-- 8. 2차용 자리만 (지금은 비워둠)
-- ---------------------------------------------------------
-- create table public.shop_items (...);        -- 미끼 교환 상품
-- create table public.redemptions (...);       -- 교환 내역 → point_ledger reason='redeem'
-- create table public.events / event_entries   -- 이벤트 응모 → reason='event_entry'

-- ---------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.catch_logs     enable row level security;
alter table public.catch_photos   enable row level security;
alter table public.point_ledger   enable row level security;
alter table public.score_events   enable row level security;
alter table public.trip_plans     enable row level security;
alter table public.user_badges    enable row level security;

-- 프로필: 본인만 수정, 닉네임은 누구나 조회(랭킹용)
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- 조과: 본인 것 전부 / 남의 것은 radius·public만
create policy "catch_select" on public.catch_logs for select
  using (auth.uid() = user_id or visibility in ('radius','public'));
create policy "catch_insert_own" on public.catch_logs for insert with check (auth.uid() = user_id);
create policy "catch_update_own" on public.catch_logs for update using (auth.uid() = user_id);
create policy "catch_delete_own" on public.catch_logs for delete using (auth.uid() = user_id);

-- 사진: 기록 소유자만
create policy "photo_own" on public.catch_photos for all
  using (exists (select 1 from public.catch_logs c where c.id = catch_log_id and c.user_id = auth.uid()));

-- 포인트·스코어: 본인만 조회, 쓰기는 service_role(엣지 함수)만
create policy "ledger_select_own" on public.point_ledger for select using (auth.uid() = user_id);
create policy "score_select_own"  on public.score_events for select using (auth.uid() = user_id);

create policy "trip_own"   on public.trip_plans  for all using (auth.uid() = user_id);
create policy "badge_own"  on public.user_badges for select using (auth.uid() = user_id);

-- 마스터 테이블은 RLS 없이 anon 읽기 허용 (species, rules, spots, facilities, codes)

-- ---------------------------------------------------------
-- 10. 히트맵용 뷰: 좌표 비노출, 반경 공개 기록을 격자(약 500m)로 집계
-- ---------------------------------------------------------
create view public.spot_heatmap as
  select
    st_snaptogrid(geom::geometry, 0.005)::geography as cell,   -- ≈ 500m
    species_id,
    count(*)                 as logs,
    sum(count)               as fish,
    max(caught_at)           as last_at
  from public.catch_logs
  where log_type = 'catch'
    and visibility in ('radius','public')
    and caught_at > now() - interval '30 days'
  group by 1, 2;

-- ---------------------------------------------------------
-- 11. 시드: 코드 테이블
-- ---------------------------------------------------------
insert into public.method_codes values
  ('float','찌'),('surf','원투'),('lure','루어'),('boat','선상'),('eging','에깅');
insert into public.bait_codes values
  ('lugworm','갯지렁이'),('krill','크릴'),('worm','웜'),('metal_jig','메탈지그'),('egi','에기');
insert into public.species (name_ko, name_std, difficulty, water_type) values
  ('우럭','조피볼락',2,'sea'),('광어','넙치',3,'sea'),('감성돔','감성돔',4,'sea'),
  ('망둥어','풀망둑',1,'sea'),('참돔','참돔',4,'sea'),('삼치','삼치',3,'sea'),
  ('붕어','붕어',2,'fresh'),('배스','큰입배스',2,'fresh');
