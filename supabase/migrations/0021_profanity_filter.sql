-- 욕설·비하 표현 금지: 대화방 글·댓글, 닉네임, 사용자 추가 어종 이름
--  - 띄어쓰기·기호·숫자를 끼운 우회('시 발', '씨1발', 'ㅅ.ㅂ')는 지우고 검사
--  - 낚시 용어 오탐 방지: '새끼 우럭', '미친 조황', '시발점', '씹어' 등은 허용. 욕으로만 쓰이는 형태만 막음
--  - 화면(src/lib/profanity.ts)도 같은 목록으로 미리 알려 줌. 목록을 바꾸면 두 곳 모두 고칠 것
create or replace function public.has_profanity(t text)
returns boolean language sql immutable as $$
  select coalesce(
    -- 띄어쓰기를 지우면 욕처럼 붙는 일상어는 먼저 뺌 ('날씨 발표' → '날씨발표', '아저씨 발' 등)
    regexp_replace(lower(regexp_replace(coalesce(t, ''), '[^가-힣a-zA-Zㄱ-ㅎㅏ-ㅣ]', '', 'g')),
                   '(시발점|시발역|날씨|솜씨|아저씨|아가씨|글씨|말씨|마음씨|맵시)', '', 'g')
    ~ (
      '(시발|씨발|씨빨|시빨|싸발|쓰발|씌발|십발|ㅅㅂ|ㅆㅂ|ㅅㅍ|ㅆㅍ|ㅅ발|시ㅂ|씨ㅂ' ||
      '|씹새|씹년|씹할|씹창|씹놈|십새끼|ㅆ년' ||
      '|병신|븅신|빙신|병싄|ㅂㅅ|ㅄ|등신' ||
      '|좆|존나|졸라게|존내|ㅈㄴ|지랄|ㅈㄹ|염병|옘병' ||
      '|개새끼|개새기|개색기|개색끼|개세끼|개쉐이|개쌔끼|개섀끼|ㄱㅅㄲ' ||
      '|썅|쌍놈|쌍년|미친놈|미친년|또라이' ||
      '|느금마|니애미|니애비|느개비|애미없|애비없|니미럴|니기미' ||
      '|엿먹어|닥쳐|호로새|호로자식|후레자식|창녀|걸레년|한남충|김치녀|된장녀|틀딱|급식충|맘충' ||
      '|fuck|fuk|shit|bitch|asshole|motherfucker|sibal|ssibal|tlqkf|qudtls)'
    ), false)
$$;

create or replace function public.community_profanity_guard()
returns trigger language plpgsql as $$
begin
  if public.has_profanity(new.body) then
    raise exception '욕설이나 비하 표현은 쓸 수 없어요' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists community_posts_profanity on public.community_posts;
create trigger community_posts_profanity before insert or update of body on public.community_posts
  for each row execute function public.community_profanity_guard();
drop trigger if exists community_comments_profanity on public.community_comments;
create trigger community_comments_profanity before insert or update of body on public.community_comments
  for each row execute function public.community_profanity_guard();

-- 이미 올라온 글·댓글 중 걸리는 것은 가림
update public.community_posts set hidden = true where public.has_profanity(body) and not hidden;
update public.community_comments set hidden = true where public.has_profanity(body) and not hidden;

-- 닉네임: set_nickname()에 검사 추가 (나머지는 0009와 같음)
create or replace function public.set_nickname(p_nickname text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v text := btrim(p_nickname);
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if v !~ '^[가-힣A-Za-z0-9_]{2,12}$' then
    raise exception '닉네임은 2~12자 한글·영문·숫자·_ 만 쓸 수 있어요' using errcode = '22023';
  end if;
  if public.has_profanity(v) or v ~* '(관리자|운영자|admin|오늘낚시)' then
    raise exception '쓸 수 없는 닉네임이에요' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(v) and id <> auth.uid()) then
    raise exception '이미 쓰고 있는 닉네임이에요' using errcode = '23505';
  end if;
  update public.profiles set nickname = v, nickname_set = true, updated_at = now() where id = auth.uid();
  return v;
end $$;

-- 사용자 추가 어종 이름
create or replace function public.species_name_guard()
returns trigger language plpgsql as $$
begin
  if new.status = 'user' and public.has_profanity(new.name_ko) then
    raise exception '쓸 수 없는 어종 이름이에요' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists species_name_guard on public.species;
create trigger species_name_guard before insert or update of name_ko on public.species
  for each row execute function public.species_name_guard();
