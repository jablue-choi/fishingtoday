-- 금어기·금지체장 데이터 (낚시 대상 주요 어종)
-- 출처: 수산자원관리법 시행령 별표1(금어기)·별표2(금지체장), 2021.1.1 개정 시행분 기준
--       해양수산부 보도자료(2023.4.28 "감성돔·고등어·주꾸미, 5월부터 금어기 시작") 교차 확인
-- ※ 지역·업종별 예외, 이후 개정은 국가법령정보센터에서 반드시 확인. 앱 표시는 안내용.

-- 1) 규칙 유형 확장: 금지체중(문어류), 매년 고시(고등어)
alter table public.closed_season_rules drop constraint if exists closed_season_rules_rule_type_check;
alter table public.closed_season_rules add constraint closed_season_rules_rule_type_check
  check (rule_type in ('season', 'min_size', 'min_weight', 'notice'));
alter table public.closed_season_rules add column if not exists min_weight_g int;
alter table public.closed_season_rules add column if not exists measure text;   -- '전장', '외투장', '체중'
alter table public.closed_season_rules add column if not exists note text;

-- 2) 규칙 대상 어종 보강
insert into public.species (name_ko, name_std, difficulty, water_type) values
  ('대구','대구',3,'sea'), ('살오징어','살오징어',2,'sea'), ('참문어','참문어',2,'sea'),
  ('쥐노래미','쥐노래미',2,'sea'), ('돌돔','돌돔',5,'sea'), ('쏘가리','쏘가리',4,'fresh')
on conflict (name_ko) do nothing;

-- 3) 데이터 (재실행 안전: 기존 행 지우고 다시)
delete from public.closed_season_rules;

insert into public.closed_season_rules (species_id, rule_type, start_mmdd, end_mmdd, min_size_cm, min_weight_g, measure, region, law_ref, note)
select s.id, r.rule_type, r.s, r.e, r.cm, r.g, r.measure, r.region, r.law_ref, r.note
from (values
  -- 어종,        유형,         시작,   종료,   체장, 체중,  측정,     지역, 근거, 비고
  ('감성돔',     'season',     '0501', '0531', null, null, null,     null, '수산자원관리법 시행령 별표1', null),
  ('감성돔',     'min_size',   null,   null,   25,   null, '전장',   null, '수산자원관리법 시행령 별표2', null),
  ('주꾸미',     'season',     '0511', '0831', null, null, null,     null, '수산자원관리법 시행령 별표1', null),
  ('삼치',       'season',     '0501', '0531', null, null, null,     null, '수산자원관리법 시행령 별표1', null),
  ('우럭',       'min_size',   null,   null,   23,   null, '전장',   null, '수산자원관리법 시행령 별표2', '조피볼락'),
  ('광어',       'min_size',   null,   null,   35,   null, '전장',   null, '수산자원관리법 시행령 별표2', '넙치'),
  ('대구',       'season',     '0116', '0215', null, null, null,     null, '수산자원관리법 시행령 별표1', null),
  ('대구',       'min_size',   null,   null,   35,   null, '전장',   null, '수산자원관리법 시행령 별표2', null),
  ('살오징어',   'season',     '0401', '0531', null, null, null,     null, '수산자원관리법 시행령 별표1', '일부 업종은 기간 다름'),
  ('살오징어',   'min_size',   null,   null,   15,   null, '외투장', null, '수산자원관리법 시행령 별표2', null),
  ('참문어',     'min_weight', null,   null,   null, 600,  '체중',   null, '수산자원관리법 시행령 별표2', null),
  ('참문어',     'season',     '0516', '0630', null, null, null,     null, '수산자원관리법 시행령 별표1', '시·도가 기간을 따로 정할 수 있음'),
  ('고등어',     'notice',     '0401', '0630', null, null, null,     null, '수산자원관리법 시행령 별표1', '이 기간 중 1개월을 해양수산부가 매년 고시'),
  ('고등어',     'min_size',   null,   null,   21,   null, '전장',   null, '수산자원관리법 시행령 별표2', null),
  ('참돔',       'min_size',   null,   null,   24,   null, '전장',   null, '수산자원관리법 시행령 별표2', null),
  ('돌돔',       'min_size',   null,   null,   24,   null, '전장',   null, '수산자원관리법 시행령 별표2', null),
  ('볼락',       'min_size',   null,   null,   15,   null, '전장',   null, '수산자원관리법 시행령 별표2', null),
  ('농어',       'min_size',   null,   null,   30,   null, '전장',   null, '수산자원관리법 시행령 별표2', null),
  ('쥐노래미',   'min_size',   null,   null,   20,   null, '전장',   null, '수산자원관리법 시행령 별표2', null),
  ('쏘가리',     'season',     '0420', '0531', null, null, null,     null, '내수면어업법 시행령', '지역별 차이 있음'),
  ('쏘가리',     'min_size',   null,   null,   18,   null, '전장',   null, '내수면어업법 시행령', null)
) as r(name, rule_type, s, e, cm, g, measure, region, law_ref, note)
join public.species s on s.name_ko = r.name;

-- 앱(로그인 사용자)이 읽을 수 있게
grant select on public.closed_season_rules to anon, authenticated;
