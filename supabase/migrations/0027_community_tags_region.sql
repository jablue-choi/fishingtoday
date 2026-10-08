-- 대화방 글: 어종 태그(#주꾸미) + 지역 키(시도 시군구) → 검색에 활용
--  tags: 어종 이름(species.name_ko) 최대 5개. 앱이 본문에서 자동으로 찾아 붙이고 사용자가 뺄 수 있음
--  region_key: '강원특별자치도 속초시' 형태. region(표시용 '속초시')과 함께 저장
alter table public.community_posts add column if not exists tags text[] not null default '{}';
alter table public.community_posts add column if not exists region_key text;
alter table public.community_posts drop constraint if exists community_posts_tags_chk;
alter table public.community_posts add constraint community_posts_tags_chk check (cardinality(tags) <= 5 and (region_key is null or length(region_key) <= 60));
create index if not exists community_posts_tags_idx on public.community_posts using gin (tags);
create index if not exists community_posts_region_key_idx on public.community_posts (region_key);
