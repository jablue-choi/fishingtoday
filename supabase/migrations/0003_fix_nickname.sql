-- 가입 트리거: 카카오 닉네임 키(name/full_name 등)도 확인
-- (실명 노출 우려로 기본값 정책은 추후 닉네임 설정 화면과 함께 재검토)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, provider)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'preferred_username',
      '조사' || left(new.id::text, 4)
    ),
    coalesce(new.raw_app_meta_data->>'provider', 'kakao')
  );
  return new;
end $$;
