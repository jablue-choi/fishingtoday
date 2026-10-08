-- 사진 어종 확인(identify_fish) 호출 기록: 사용자별 하루 호출 수 제한용
--  - 엣지 함수(service_role)만 쓰고 읽음. 사진·결과 원문은 저장하지 않음
create table if not exists public.fish_id_usage (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  species    text,                 -- 판별 결과(어종명 또는 null)
  confidence text,
  created_at timestamptz not null default now()
);
create index if not exists fish_id_usage_user_idx on public.fish_id_usage (user_id, created_at desc);
alter table public.fish_id_usage enable row level security;   -- 정책 없음 = 클라이언트 접근 불가
revoke all on public.fish_id_usage from anon, authenticated;
