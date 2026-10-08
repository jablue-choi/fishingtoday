-- 대화방(질문·댓글 게시판): 오늘 / 어종 / 지역
--  room_type: today(room_key='today', 그날 글만 보여 줌) / species(room_key=species.code) / region(room_key='시도 시군구')
--  신고 3건이면 자동 숨김, 하루 글 20·댓글 100 제한, 본인 글·댓글 삭제 가능, 관리자는 숨김 글도 보고 숨김 처리 가능

create table if not exists public.community_posts (
  id            uuid primary key default gen_random_uuid(),
  room_type     text not null check (room_type in ('today', 'species', 'region')),
  room_key      text not null check (length(room_key) between 1 and 60),
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body          text not null check (length(btrim(body)) between 2 and 1000),
  region        text,                         -- 글쓴이가 고른 지역 이름(선택, 시군구까지만)
  comment_count int not null default 0,
  report_count  int not null default 0,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists community_posts_room_idx on public.community_posts (room_type, room_key, created_at desc);
create index if not exists community_posts_recent_idx on public.community_posts (created_at desc);

create table if not exists public.community_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.community_posts(id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body         text not null check (length(btrim(body)) between 1 and 500),
  report_count int not null default 0,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);

create table if not exists public.community_reports (
  id          bigserial primary key,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   uuid not null,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason      text check (length(reason) <= 200),
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

-- RLS
alter table public.community_posts    enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reports  enable row level security;
revoke all on public.community_posts, public.community_comments, public.community_reports from anon;

create policy "cposts_read" on public.community_posts for select to authenticated
  using (not hidden or user_id = auth.uid() or public.is_admin());
create policy "cposts_insert" on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and not hidden and report_count = 0 and comment_count = 0);
create policy "cposts_delete" on public.community_posts for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "cposts_admin_update" on public.community_posts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "ccomments_read" on public.community_comments for select to authenticated
  using (not hidden or user_id = auth.uid() or public.is_admin());
create policy "ccomments_insert" on public.community_comments for insert to authenticated
  with check (user_id = auth.uid() and not hidden and report_count = 0
              and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden));
create policy "ccomments_delete" on public.community_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "ccomments_admin_update" on public.community_comments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "creports_insert" on public.community_reports for insert to authenticated with check (user_id = auth.uid());
create policy "creports_read_admin" on public.community_reports for select to authenticated using (public.is_admin());

-- 하루 작성 제한 (KST 자정 기준)
create or replace function public.community_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare since timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if tg_table_name = 'community_posts' then
    if (select count(*) from public.community_posts where user_id = new.user_id and created_at >= since) >= 20 then
      raise exception '오늘은 질문을 더 올릴 수 없어요 (하루 20개)' using errcode = '54000';
    end if;
  else
    if (select count(*) from public.community_comments where user_id = new.user_id and created_at >= since) >= 100 then
      raise exception '오늘은 댓글을 더 달 수 없어요 (하루 100개)' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists community_posts_rate on public.community_posts;
create trigger community_posts_rate before insert on public.community_posts for each row execute function public.community_rate_limit();
drop trigger if exists community_comments_rate on public.community_comments;
create trigger community_comments_rate before insert on public.community_comments for each row execute function public.community_rate_limit();

-- 댓글 수
create or replace function public.community_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.community_posts set comment_count = (
    select count(*) from public.community_comments c where c.post_id = coalesce(new.post_id, old.post_id) and not c.hidden
  ) where id = coalesce(new.post_id, old.post_id);
  return null;
end $$;
drop trigger if exists community_comment_count on public.community_comments;
create trigger community_comment_count after insert or delete or update of hidden on public.community_comments
  for each row execute function public.community_comment_count();

-- 신고: 3건이면 자동 숨김
create or replace function public.community_report_apply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'post' then
    update public.community_posts set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3 where id = new.target_id;
  else
    update public.community_comments set report_count = report_count + 1, hidden = hidden or report_count + 1 >= 3 where id = new.target_id;
  end if;
  return new;
end $$;
drop trigger if exists community_report_apply on public.community_reports;
create trigger community_report_apply after insert on public.community_reports for each row execute function public.community_report_apply();

-- 대화방 목록용: 방별 최근 7일 글 수·마지막 글 시각
create or replace function public.community_room_stats()
returns table (room_type text, room_key text, posts int, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.room_type, p.room_key, count(*)::int, max(p.created_at)
  from public.community_posts p
  where not p.hidden and p.created_at > now() - interval '7 days'
  group by 1, 2
$$;
revoke all on function public.community_room_stats() from public, anon;
grant execute on function public.community_room_stats() to authenticated;
