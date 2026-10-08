-- 피드: 장비 자랑(gear) / 미끼 레시피(recipe) / 영상(video, 유튜브)
--  사진은 공개 버킷 feed-photos (앱에서 1280px로 줄여 올려서 EXIF 위치정보 제거). 본인 폴더(user_id/)에만 올림
--  좋아요·댓글·신고(3건 자동 숨김)·욕설 차단·차단 회원 쓰기 금지·하루 글 10·댓글 100
--  피드 글 포인트 20P, 하루 1번 (하루 전체 200P 상한 안에서)

-- 사진 버킷
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-photos', 'feed-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feed_photos_insert_own" on storage.objects;
create policy "feed_photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'feed-photos' and (storage.foldername(name))[1] = auth.uid()::text and not public.is_blocked());
drop policy if exists "feed_photos_delete_own" on storage.objects;
create policy "feed_photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'feed-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.feed_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind          text not null check (kind in ('gear', 'recipe', 'video')),
  title         text not null check (length(btrim(title)) between 2 and 60),
  body          text check (length(body) <= 2000),
  photo_url     text check (photo_url is null or photo_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/feed-photos/'),
  gear          jsonb,          -- {rod, reel, line, lure, etc}
  recipe        jsonb,          -- {ingredients, steps}
  species_code  text,
  tags          text[] not null default '{}' check (cardinality(tags) <= 5),
  video_id      text check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_title   text check (length(video_title) <= 200),
  video_author  text check (length(video_author) <= 100),
  like_count    int not null default 0,
  comment_count int not null default 0,
  report_count  int not null default 0,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now(),
  check (kind <> 'video' or video_id is not null)
);
create index if not exists feed_posts_kind_idx on public.feed_posts (kind, created_at desc);
create index if not exists feed_posts_recent_idx on public.feed_posts (created_at desc);

create table if not exists public.feed_likes (
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.feed_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.feed_posts(id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body         text not null check (length(btrim(body)) between 1 and 500),
  report_count int not null default 0,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists feed_comments_post_idx on public.feed_comments (post_id, created_at);

alter table public.feed_posts    enable row level security;
alter table public.feed_likes    enable row level security;
alter table public.feed_comments enable row level security;
revoke all on public.feed_posts, public.feed_likes, public.feed_comments from anon;

create policy "fposts_read" on public.feed_posts for select to authenticated using (not hidden or user_id = auth.uid() or public.is_admin());
create policy "fposts_insert" on public.feed_posts for insert to authenticated
  with check (user_id = auth.uid() and not hidden and like_count = 0 and comment_count = 0 and report_count = 0 and not public.is_blocked());
create policy "fposts_delete" on public.feed_posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "fposts_admin_update" on public.feed_posts for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "flikes_read" on public.feed_likes for select to authenticated using (true);
create policy "flikes_insert" on public.feed_likes for insert to authenticated with check (user_id = auth.uid() and not public.is_blocked());
create policy "flikes_delete" on public.feed_likes for delete to authenticated using (user_id = auth.uid());

create policy "fcomments_read" on public.feed_comments for select to authenticated using (not hidden or user_id = auth.uid() or public.is_admin());
create policy "fcomments_insert" on public.feed_comments for insert to authenticated
  with check (user_id = auth.uid() and not hidden and report_count = 0 and not public.is_blocked()
              and exists (select 1 from public.feed_posts p where p.id = post_id and not p.hidden));
create policy "fcomments_delete" on public.feed_comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "fcomments_admin_update" on public.feed_comments for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 욕설·하루 제한
create or replace function public.feed_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare since timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if tg_table_name = 'feed_posts' then
    if public.has_profanity(new.title) or public.has_profanity(new.body) or public.has_profanity(new.gear::text) or public.has_profanity(new.recipe::text) then
      raise exception '욕설이나 비하 표현은 쓸 수 없어요' using errcode = '22023';
    end if;
    if (select count(*) from public.feed_posts where user_id = new.user_id and created_at >= since) >= 10 then
      raise exception '오늘은 글을 더 올릴 수 없어요 (하루 10개)' using errcode = '54000';
    end if;
  else
    if public.has_profanity(new.body) then raise exception '욕설이나 비하 표현은 쓸 수 없어요' using errcode = '22023'; end if;
    if (select count(*) from public.feed_comments where user_id = new.user_id and created_at >= since) >= 100 then
      raise exception '오늘은 댓글을 더 달 수 없어요 (하루 100개)' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists feed_posts_guard on public.feed_posts;
create trigger feed_posts_guard before insert or update of title, body, gear, recipe on public.feed_posts for each row execute function public.feed_guard();
drop trigger if exists feed_comments_guard on public.feed_comments;
create trigger feed_comments_guard before insert or update of body on public.feed_comments for each row execute function public.feed_guard();

-- 좋아요·댓글 수
create or replace function public.feed_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  if tg_table_name = 'feed_likes' then
    update public.feed_posts set like_count = (select count(*) from public.feed_likes where post_id = pid) where id = pid;
  else
    update public.feed_posts set comment_count = (select count(*) from public.feed_comments where post_id = pid and not hidden) where id = pid;
  end if;
  return null;
end $$;
drop trigger if exists feed_likes_count on public.feed_likes;
create trigger feed_likes_count after insert or delete on public.feed_likes for each row execute function public.feed_counts();
drop trigger if exists feed_comments_count on public.feed_comments;
create trigger feed_comments_count after insert or delete or update of hidden on public.feed_comments for each row execute function public.feed_counts();

-- 피드 글 포인트: 하루 1번 20P
create or replace function public.feed_posts_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.point_ledger where user_id = new.user_id and reason = 'feed_post'
               and created_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') then return null; end if;
  perform public.award_ledger(new.user_id, 'feed_post', coalesce((select amount from public.point_rules where reason = 'feed_post'), 20), 'feed_post', new.id);
  return null;
end $$;
drop trigger if exists feed_posts_points on public.feed_posts;
create trigger feed_posts_points after insert on public.feed_posts for each row execute function public.feed_posts_points();

-- 신고 반영: 대화방·피드·장소 제보 공통 (3건이면 숨김)
create or replace function public.community_report_apply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  case new.target_type
    when 'post' then update public.community_posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3 where id = new.target_id;
    when 'comment' then update public.community_comments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3 where id = new.target_id;
    when 'feed' then update public.feed_posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3 where id = new.target_id;
    when 'feed_comment' then update public.feed_comments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3 where id = new.target_id;
    when 'place_note' then update public.place_notes set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3 where id = new.target_id;
  end case;
  return new;
end $$;

-- 관리자: 신고 목록 (대상 내용·작성자 포함)
create or replace function public.admin_list_reports(p_limit int default 50)
returns table (id bigint, target_type text, target_id uuid, reason text, created_at timestamptz, reporter text,
               body text, author_id uuid, author text, hidden boolean, report_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요' using errcode = '42501'; end if;
  return query
  with t as (
    select 'post'::text as tt, x.id, x.body, x.user_id, x.hidden, x.report_count from public.community_posts x
    union all select 'comment', x.id, x.body, x.user_id, x.hidden, x.report_count from public.community_comments x
    union all select 'feed', x.id, x.title || coalesce(' — ' || x.body, ''), x.user_id, x.hidden, x.report_count from public.feed_posts x
    union all select 'feed_comment', x.id, x.body, x.user_id, x.hidden, x.report_count from public.feed_comments x
    union all select 'place_note', x.id, coalesce(x.place_name, '') || ' · ' || x.kind || coalesce(' — ' || x.body, ''), x.user_id, x.hidden, x.report_count from public.place_notes x
  )
  select r.id, r.target_type, r.target_id, r.reason, r.created_at, rp.nickname, t.body, t.user_id, ap.nickname, t.hidden, t.report_count
  from public.community_reports r
  left join t on t.tt = r.target_type and t.id = r.target_id
  left join public.profiles rp on rp.id = r.user_id
  left join public.profiles ap on ap.id = t.user_id
  order by r.created_at desc
  limit greatest(1, least(p_limit, 200));
end $$;
revoke all on function public.admin_list_reports(int) from public, anon;
grant execute on function public.admin_list_reports(int) to authenticated;

-- 관리자: 숨김/해제 (모든 종류)
create or replace function public.admin_set_hidden(p_type text, p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  case p_type
    when 'post' then update public.community_posts set hidden = p_hidden where id = p_id;
    when 'comment' then update public.community_comments set hidden = p_hidden where id = p_id;
    when 'feed' then update public.feed_posts set hidden = p_hidden where id = p_id;
    when 'feed_comment' then update public.feed_comments set hidden = p_hidden where id = p_id;
    when 'place_note' then update public.place_notes set hidden = p_hidden where id = p_id;
  end case;
end $$;
revoke all on function public.admin_set_hidden(text, uuid, boolean) from public, anon;
grant execute on function public.admin_set_hidden(text, uuid, boolean) to authenticated;

-- 차단 시 숨김 범위를 피드·제보까지 (0022 함수 갱신)
create or replace function public.admin_block_user(p_user uuid, p_days int, p_reason text, p_hide boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception '관리자는 차단할 수 없어요' using errcode = '22023'; end if;
  insert into public.user_blocks (user_id, until, reason, blocked_by)
  values (p_user, case when p_days is null then null else now() + make_interval(days => p_days) end, nullif(btrim(p_reason), ''), auth.uid())
  on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, blocked_by = excluded.blocked_by, created_at = now();
  if p_hide then
    update public.community_posts set hidden = true where user_id = p_user;
    update public.community_comments set hidden = true where user_id = p_user;
    update public.feed_posts set hidden = true where user_id = p_user;
    update public.feed_comments set hidden = true where user_id = p_user;
    update public.place_notes set hidden = true where user_id = p_user;
  end if;
end $$;
