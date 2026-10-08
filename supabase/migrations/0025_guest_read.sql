-- 로그인 전 둘러보기: 공개 정보만 anon 읽기 허용 (쓰기는 전부 로그인 필요)
--  허용: 공개 조과 뷰(좌표 500m 반올림), 닉네임, 랭킹, 대화방·피드·장소 팁 읽기, 화장실·포인트·제철 어종
--  계속 막음: catch_logs 원본(정확한 좌표), 내 기록, 포인트 원장, 관리·신고·차단 정보
--  anon 정책은 is_admin()을 부르지 않도록 따로 둠 (anon은 is_admin 실행 권한 없음)

-- 닉네임 (글쓴이 표시용)
grant select (id, nickname) on public.profiles to anon;
drop policy if exists "profiles_select_anon" on public.profiles;
create policy "profiles_select_anon" on public.profiles for select to anon using (true);

-- 공개 조과 (검색·지역 어종 순위·제철 카드 최근 조황)
grant select on public.public_catch_v to anon;

-- 대화방
grant select on public.community_posts, public.community_comments to anon;
drop policy if exists "cposts_read_anon" on public.community_posts;
create policy "cposts_read_anon" on public.community_posts for select to anon using (not hidden);
drop policy if exists "ccomments_read_anon" on public.community_comments;
create policy "ccomments_read_anon" on public.community_comments for select to anon using (not hidden);

-- 피드
grant select on public.feed_posts, public.feed_comments to anon;
drop policy if exists "fposts_read_anon" on public.feed_posts;
create policy "fposts_read_anon" on public.feed_posts for select to anon using (not hidden);
drop policy if exists "fcomments_read_anon" on public.feed_comments;
create policy "fcomments_read_anon" on public.feed_comments for select to anon using (not hidden);

-- 장소 팁·제보, 화장실
grant select on public.place_notes, public.toilets to anon;
drop policy if exists "pnotes_read_anon" on public.place_notes;
create policy "pnotes_read_anon" on public.place_notes for select to anon using (not hidden);
drop policy if exists "toilets_read_anon" on public.toilets;
create policy "toilets_read_anon" on public.toilets for select to anon using (true);

-- 제철 어종 (0015에서 anon 읽기 정책은 이미 있음)
grant select on public.species_seasons to anon;

-- 읽기 함수
grant execute on function public.angler_ranking(text, int) to anon;
grant execute on function public.community_room_stats() to anon;
grant execute on function public.toilets_near(double precision, double precision, double precision, int) to anon;
grant execute on function public.spots_near(double precision, double precision, double precision, int) to anon;
