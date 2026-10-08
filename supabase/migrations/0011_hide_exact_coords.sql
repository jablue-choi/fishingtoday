-- 좌표 노출 차단
--  - catch_logs 원본 행(정확한 geom)은 본인만 조회
--  - 다른 사람 기록은 public_catch_v(500m 반올림)로만: security_invoker 끄고 뷰 소유자 권한으로 실행
--    (catch_logs RLS가 본인만으로 좁혀져도 공개 기록을 보여 주기 위함. 뷰에는 user_id·정확한 좌표 없음)
--  - anon은 기록 관련 테이블·뷰 전부 조회 불가 (앱은 로그인 후에만 사용)

drop policy if exists "catch_select" on public.catch_logs;
create policy "catch_select_own" on public.catch_logs for select
  to authenticated using (auth.uid() = user_id);

alter view public.public_catch_v set (security_invoker = false);

revoke all on public.catch_logs     from anon;
revoke all on public.catch_photos   from anon;
revoke all on public.catch_logs_v   from anon;
revoke all on public.public_catch_v from anon;
revoke all on public.spot_heatmap   from anon;

grant select on public.public_catch_v to authenticated;
grant select on public.spot_heatmap   to authenticated;
