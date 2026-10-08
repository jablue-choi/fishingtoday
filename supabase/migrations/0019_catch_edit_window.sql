-- 내 기록 수정 제한: 랭킹·스코어에 쓰이는 값(어종·마릿수·크기·종류·시각·위치)은 기록 후 24시간 안에만 수정
--  방법·미끼·공개 여부·자랑글 링크는 언제든 수정 가능. service_role(엣지 함수)·관리자 함수는 제한 없음
create or replace function public.catch_logs_edit_guard()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'service_role' or old.entered_by = 'admin' then return new; end if;
  if now() - old.created_at > interval '24 hours' and (
       new.species_id is distinct from old.species_id or new.count is distinct from old.count
    or new.size_cm is distinct from old.size_cm or new.log_type is distinct from old.log_type
    or new.caught_at is distinct from old.caught_at or not st_equals(new.geom::geometry, old.geom::geometry)
  ) then
    raise exception '어종·마릿수·크기·날짜·위치는 기록 후 24시간 안에만 고칠 수 있어요' using errcode = '42501';
  end if;
  -- 사용자는 포인트 판정·인증 관련 값을 바꿀 수 없음
  new.verified := old.verified;
  new.created_at := old.created_at;
  new.user_id := old.user_id;
  return new;
end $$;

drop trigger if exists catch_logs_edit_guard on public.catch_logs;
create trigger catch_logs_edit_guard before update on public.catch_logs
  for each row execute function public.catch_logs_edit_guard();
