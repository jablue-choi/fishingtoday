-- 지도형 정보: 화장실(공공데이터) + 장소 제보·팁(화장실·낚시점·미끼점·맛집) + 제보 포인트
--  화장실: 공공데이터포털 '전국공중화장실표준데이터' → scripts/import-toilets.mjs
--  낚시점·미끼점·맛집: 카카오 장소 검색(앱에서) + place_notes에 팁
--  제보 포인트: 건당 10P, 하루 5건, 같은 장소는 하루 1번만, 하루 전체 200P 상한 안에서 (DB 트리거가 원장에 씀)

create table if not exists public.toilets (
  id          serial primary key,
  source      text not null default 'mois_toilet',
  external_id text not null,
  name        text not null,
  address     text,
  open_time   text,
  phone       text,
  geom        geography(point, 4326) not null,
  info        jsonb,
  unique (source, external_id)
);
create index if not exists toilets_geom_idx on public.toilets using gist (geom);
alter table public.toilets enable row level security;
create policy "toilets_read" on public.toilets for select to authenticated using (true);
revoke insert, update, delete on public.toilets from anon, authenticated;

create table if not exists public.place_notes (
  id           uuid primary key default gen_random_uuid(),
  place_type   text not null check (place_type in ('toilet', 'shop', 'bait', 'food')),
  place_ref    text not null check (length(place_ref) between 1 and 80),   -- 화장실 id 또는 카카오 장소 id
  place_name   text check (length(place_name) <= 80),
  geom         geography(point, 4326),
  kind         text not null check (kind in ('clean', 'dirty', 'locked', 'gone', 'tip')),
  body         text check (length(body) <= 300),
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  report_count int not null default 0,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now(),
  check (kind <> 'tip' or length(btrim(coalesce(body, ''))) >= 2)
);
create index if not exists place_notes_ref_idx on public.place_notes (place_type, place_ref, created_at desc);
alter table public.place_notes enable row level security;
revoke all on public.place_notes from anon;
create policy "pnotes_read" on public.place_notes for select to authenticated using (not hidden or user_id = auth.uid() or public.is_admin());
create policy "pnotes_insert" on public.place_notes for insert to authenticated
  with check (user_id = auth.uid() and not hidden and report_count = 0 and not public.is_blocked());
create policy "pnotes_delete" on public.place_notes for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "pnotes_admin_update" on public.place_notes for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 욕설·하루 30건 제한
create or replace function public.place_notes_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_profanity(new.body) or public.has_profanity(new.place_name) then
    raise exception '욕설이나 비하 표현은 쓸 수 없어요' using errcode = '22023';
  end if;
  if (select count(*) from public.place_notes where user_id = new.user_id
        and created_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') >= 30 then
    raise exception '오늘은 제보를 더 할 수 없어요 (하루 30건)' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists place_notes_guard on public.place_notes;
create trigger place_notes_guard before insert on public.place_notes for each row execute function public.place_notes_guard();

-- 포인트 사유 추가
alter table public.point_ledger drop constraint if exists point_ledger_reason_check;
alter table public.point_ledger add constraint point_ledger_reason_check check (reason in (
  'base_log', 'photo_verified', 'first_visit', 'release', 'zero_log', 'brag_link', 'place_note', 'feed_post',
  'daily_cap_adjust', 'redeem', 'event_entry', 'admin'
));
insert into public.point_rules (reason, amount) values ('place_note', 10), ('feed_post', 20)
on conflict (reason) do update set amount = excluded.amount;

-- 공용: 하루 적립 상한(200P) 안에서 원장에 쓰기. 실제 적립액 반환
create or replace function public.award_ledger(p_user uuid, p_reason text, p_amount int, p_ref_type text, p_ref uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  since timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  room int;
begin
  select greatest(0, 200 - coalesce(sum(amount), 0)) into room from public.point_ledger where user_id = p_user and amount > 0 and created_at >= since;
  if room <= 0 or p_amount <= 0 then return 0; end if;
  insert into public.point_ledger (user_id, amount, reason, ref_type, ref_id)
  values (p_user, least(p_amount, room), p_reason, p_ref_type, p_ref)
  on conflict do nothing;
  return least(p_amount, room);
end $$;
revoke all on function public.award_ledger(uuid, text, int, text, uuid) from public, anon, authenticated;

-- 제보 포인트: 하루 5건, 같은 장소 하루 1번
create or replace function public.place_notes_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare since timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if (select count(*) from public.point_ledger where user_id = new.user_id and reason = 'place_note' and created_at >= since) >= 5 then return null; end if;
  if exists (select 1 from public.place_notes n where n.user_id = new.user_id and n.place_type = new.place_type and n.place_ref = new.place_ref
               and n.id <> new.id and n.created_at >= since) then return null; end if;
  perform public.award_ledger(new.user_id, 'place_note', coalesce((select amount from public.point_rules where reason = 'place_note'), 10), 'place_note', new.id);
  return null;
end $$;
drop trigger if exists place_notes_points on public.place_notes;
create trigger place_notes_points after insert on public.place_notes for each row execute function public.place_notes_points();

-- 화장실 주변 조회 + 최근 30일 제보 요약
create or replace function public.toilets_near(p_lat double precision, p_lon double precision, p_km double precision default 3, p_limit int default 30)
returns table (id int, name text, address text, open_time text, lat double precision, lon double precision, dist_m double precision,
               clean int, dirty int, locked int, gone int, last_kind text, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.address, t.open_time, st_y(t.geom::geometry), st_x(t.geom::geometry),
         st_distance(t.geom, st_makepoint(p_lon, p_lat)::geography),
         count(n.*) filter (where n.kind = 'clean')::int, count(n.*) filter (where n.kind = 'dirty')::int,
         count(n.*) filter (where n.kind = 'locked')::int, count(n.*) filter (where n.kind = 'gone')::int,
         (array_agg(n.kind order by n.created_at desc) filter (where n.kind <> 'tip'))[1],
         max(n.created_at)
  from public.toilets t
  left join public.place_notes n on n.place_type = 'toilet' and n.place_ref = t.id::text and not n.hidden and n.created_at > now() - interval '30 days'
  where st_dwithin(t.geom, st_makepoint(p_lon, p_lat)::geography, least(p_km, 20) * 1000)
  group by t.id
  order by t.geom <-> st_makepoint(p_lon, p_lat)::geography
  limit greatest(1, least(p_limit, 100))
$$;
revoke all on function public.toilets_near(double precision, double precision, double precision, int) from public, anon;
grant execute on function public.toilets_near(double precision, double precision, double precision, int) to authenticated;

-- 신고 대상에 장소 제보·피드 추가 (피드 테이블은 0024)
alter table public.community_reports drop constraint if exists community_reports_target_type_check;
alter table public.community_reports add constraint community_reports_target_type_check
  check (target_type in ('post', 'comment', 'place_note', 'feed', 'feed_comment'));
