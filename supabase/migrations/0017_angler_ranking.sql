-- 낚시왕 랭킹 (개인). 동호회 랭킹은 2차
--  - 스코어 = 마릿수×5 + 최대 크기×0.6 + 어종 난이도×4 + 방생 10 (award_points와 같은 공식, 기록마다 합산)
--  - 공개(radius/public) 기록만, 관리자 등록·하루 넘게 지나서 적은 기록 제외
--  - 기간: today / week(월요일 시작) / month, 한국 시간 기준
create or replace function public.angler_ranking(p_period text default 'today', p_limit int default 20)
returns table (
  rank int, nickname text, is_me boolean, is_sample boolean,
  score int, fish int, logs int, best_species text, best_size numeric, region text
)
language sql stable security definer set search_path = public as $$
  with bounds as (
    select (date_trunc(case p_period when 'week' then 'week' when 'month' then 'month' else 'day' end,
                       now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as since
  ),
  logs as (
    select c.user_id, c.is_sample, c.count, c.size_cm, c.log_type, c.region, c.caught_at,
           s.name_ko, coalesce(s.difficulty, 1) as difficulty,
           c.count * 5 + round(coalesce(c.size_cm, 0) * 0.6) + coalesce(s.difficulty, 1) * 4
             + case when c.log_type = 'release' then 10 else 0 end as score
    from public.catch_logs c
    left join public.species s on s.id = c.species_id
    cross join bounds b
    where c.caught_at >= b.since
      and c.log_type in ('catch', 'release')
      and c.visibility in ('radius', 'public')
      and c.entered_by = 'user'
      and (c.is_sample or c.created_at - c.caught_at <= interval '24 hours')   -- 샘플은 한꺼번에 넣어서 예외
  ),
  best as (   -- 사람마다 가장 큰(없으면 가장 많이 잡은) 한 건
    select distinct on (user_id) user_id, name_ko, size_cm, region
    from logs order by user_id, size_cm desc nulls last, count desc, caught_at desc
  ),
  agg as (
    select l.user_id, bool_or(l.is_sample) as is_sample, sum(l.score)::int as score,
           sum(l.count)::int as fish, count(*)::int as logs
    from logs l group by l.user_id
  ),
  ranked as (
    select rank() over (order by a.score desc, a.fish desc)::int as rank,
           p.nickname, a.user_id = auth.uid() as is_me, a.is_sample,
           a.score, a.fish, a.logs, b.name_ko as best_species, b.size_cm as best_size, b.region
    from agg a
    join public.profiles p on p.id = a.user_id
    join best b on b.user_id = a.user_id
  )
  select * from ranked
  where ranked.rank <= greatest(1, least(p_limit, 100)) or ranked.is_me
  order by ranked.rank
$$;
revoke all on function public.angler_ranking(text, int) from public, anon;
grant execute on function public.angler_ranking(text, int) to authenticated;
