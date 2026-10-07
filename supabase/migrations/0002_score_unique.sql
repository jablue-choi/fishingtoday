-- 기록 하나당 스코어 이벤트 1건 (award_points upsert용)
create unique index if not exists score_events_catch_idx
  on public.score_events (catch_log_id) where catch_log_id is not null;
