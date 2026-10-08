-- 실명 노출 차단
--  - 가입 트리거가 카카오 name(실명)을 nickname에 넣던 것 → 임의 닉네임으로
--  - 첫 로그인 때 닉네임 설정 (nickname_set=false면 앱이 설정 화면을 띄움)
--  - profiles는 로그인 사용자만, 공개 컬럼(id, nickname)만 조회
--  - 닉네임 변경은 set_nickname() 으로만 (형식·중복 검사)

alter table public.profiles add column if not exists nickname_set boolean not null default false;

-- 임의 닉네임: '조사' + id 해시 6자리
create or replace function public.random_nickname(uid uuid)
returns text language sql immutable as $$
  select '조사' || left(md5(uid::text), 6)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, provider)
  values (
    new.id,
    public.random_nickname(new.id),
    coalesce(new.raw_app_meta_data->>'provider', 'kakao')
  );
  return new;
end $$;

-- 기존 사용자: 샘플 유저는 그대로 두고, 나머지는 임의 닉네임으로 바꾼 뒤 다시 설정받기
update public.profiles
   set nickname_set = true
 where id::text like '11111111-1111-4111-8111-%';
update public.profiles
   set nickname = public.random_nickname(id), nickname_set = false, updated_at = now()
 where id::text not like '11111111-1111-4111-8111-%';

create unique index if not exists profiles_nickname_uidx on public.profiles (lower(nickname));

-- 조회: 로그인 사용자만. 컬럼은 공개용만 (provider·선호 등은 본인도 지금은 안 씀)
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_auth" on public.profiles for select to authenticated using (true);
revoke all on public.profiles from anon;
revoke select, insert, update, delete on public.profiles from authenticated;
grant select (id, nickname, nickname_set, created_at) on public.profiles to authenticated;
grant update (pref_method, home_region, updated_at) on public.profiles to authenticated;

-- 닉네임 변경: 2~12자, 한글·영문·숫자·_ 만, 중복 불가
create or replace function public.set_nickname(p_nickname text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v text := btrim(p_nickname);
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if v !~ '^[가-힣A-Za-z0-9_]{2,12}$' then
    raise exception '닉네임은 2~12자 한글·영문·숫자·_ 만 쓸 수 있어요' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(v) and id <> auth.uid()) then
    raise exception '이미 쓰고 있는 닉네임이에요' using errcode = '23505';
  end if;
  update public.profiles set nickname = v, nickname_set = true, updated_at = now() where id = auth.uid();
  return v;
end $$;

revoke all on function public.set_nickname(text) from public, anon;
grant execute on function public.set_nickname(text) to authenticated;

-- 공개 기록 뷰에 닉네임이 들어 있으므로 anon 조회도 막기 (앱은 로그인 후에만 검색)
revoke all on public.public_catch_v from anon;
