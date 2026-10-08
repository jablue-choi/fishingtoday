-- 회원 차단 + 관리자 회원·신고 관리
--  차단된 회원: 대화방·피드·제보·신고 등 남에게 보이는 글은 못 씀 (내 조과 기록은 가능)
--  기간 차단(until) 또는 영구 차단(until null). 관리자는 차단할 수 없음

create table if not exists public.user_blocks (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  until      timestamptz,                 -- null = 영구
  reason     text check (length(reason) <= 200),
  blocked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.user_blocks enable row level security;       -- 정책 없음: 함수로만
revoke all on public.user_blocks from anon, authenticated;

create or replace function public.is_blocked(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks b where b.user_id = p_user and (b.until is null or b.until > now()))
$$;
revoke all on function public.is_blocked(uuid) from public, anon;
grant execute on function public.is_blocked(uuid) to authenticated;

create or replace function public.my_block_status()
returns table (blocked boolean, until timestamptz, reason text)
language sql stable security definer set search_path = public as $$
  select (b.until is null or b.until > now()), b.until, b.reason
  from public.user_blocks b where b.user_id = auth.uid() and (b.until is null or b.until > now())
$$;
revoke all on function public.my_block_status() from public, anon;
grant execute on function public.my_block_status() to authenticated;

-- 대화방 쓰기 정책에 차단 확인 추가
drop policy if exists "cposts_insert" on public.community_posts;
create policy "cposts_insert" on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and not hidden and report_count = 0 and comment_count = 0 and not public.is_blocked());
drop policy if exists "ccomments_insert" on public.community_comments;
create policy "ccomments_insert" on public.community_comments for insert to authenticated
  with check (user_id = auth.uid() and not hidden and report_count = 0 and not public.is_blocked()
              and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden));
drop policy if exists "creports_insert" on public.community_reports;
create policy "creports_insert" on public.community_reports for insert to authenticated
  with check (user_id = auth.uid() and not public.is_blocked());

-- 관리자: 회원 목록 (닉네임 검색)
create or replace function public.admin_list_members(p_q text default '', p_limit int default 50)
returns table (
  id uuid, nickname text, provider text, created_at timestamptz,
  logs int, posts int, comments int, reports_received int,
  blocked boolean, blocked_until timestamptz, block_reason text, is_admin boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요' using errcode = '42501'; end if;
  return query
  select p.id, p.nickname, p.provider, p.created_at,
    (select count(*)::int from public.catch_logs c where c.user_id = p.id),
    (select count(*)::int from public.community_posts cp where cp.user_id = p.id),
    (select count(*)::int from public.community_comments cc where cc.user_id = p.id),
    (select count(*)::int from public.community_reports r
       where (r.target_type = 'post' and r.target_id in (select cp.id from public.community_posts cp where cp.user_id = p.id))
          or (r.target_type = 'comment' and r.target_id in (select cc.id from public.community_comments cc where cc.user_id = p.id))),
    coalesce(b.until is null or b.until > now(), false) and b.user_id is not null,
    b.until, b.reason,
    exists (select 1 from public.admins a where a.user_id = p.id)
  from public.profiles p
  left join public.user_blocks b on b.user_id = p.id
  where p_q = '' or p.nickname ilike '%' || p_q || '%'
  order by (b.user_id is not null and (b.until is null or b.until > now())) desc, p.created_at desc
  limit greatest(1, least(p_limit, 200));
end $$;
revoke all on function public.admin_list_members(text, int) from public, anon;
grant execute on function public.admin_list_members(text, int) to authenticated;

-- 관리자: 차단 (p_days null = 영구), p_hide면 그 회원이 쓴 대화방 글·댓글도 가림
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
  end if;
end $$;
revoke all on function public.admin_block_user(uuid, int, text, boolean) from public, anon;
grant execute on function public.admin_block_user(uuid, int, text, boolean) to authenticated;

create or replace function public.admin_unblock_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  delete from public.user_blocks where user_id = p_user;
end $$;
revoke all on function public.admin_unblock_user(uuid) from public, anon;
grant execute on function public.admin_unblock_user(uuid) to authenticated;
