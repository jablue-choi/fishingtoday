-- 자랑글 링크 포인트: 내 조과 기록에 블로그·카페 글 링크를 붙이면 기록당 1회 50P
--  (award_points action='brag'. 하루 넘게 지나서 적은 기록·꽝·같은 링크 재사용은 제외, 하루 상한 200P 안에서)
alter table public.point_ledger drop constraint if exists point_ledger_reason_check;
alter table public.point_ledger add constraint point_ledger_reason_check check (reason in (
  'base_log', 'photo_verified', 'first_visit', 'release', 'zero_log', 'brag_link',
  'daily_cap_adjust', 'redeem', 'event_entry', 'admin'
));
insert into public.point_rules (reason, amount) values ('brag_link', 50)
on conflict (reason) do update set amount = excluded.amount;
