-- 금어기·금지체장 현행 법령 대조 (2026-10-09)
-- 원문: 국가법령정보센터 수산자원관리법 시행령(대통령령 제36423호, 2026.7.1 시행) 별표1(개정 2026.6.23)·별표2(개정 2024.6.4)
--       내수면어업법 시행령 별표1, 해양수산부 고시 제2024-40호(포획금지기간)
-- 기존 규칙 23건은 쏘가리 금어기 외 모두 원문과 일치. 체장 기준은 모두 '이하' 포획 금지
-- ※ 시·도지사가 더 강한 기준을 고시할 수 있음(법 제14조④). 앱 표시는 안내용

-- 1) 쏘가리 금어기: 권역 × 하천/댐·호소 4구간 (region이 있으면 앱은 '해당 지역이면 금어기' 안내로 보여 줌)
delete from public.closed_season_rules
where rule_type = 'season' and species_id = (select id from public.species where name_ko = '쏘가리');

insert into public.closed_season_rules (species_id, rule_type, start_mmdd, end_mmdd, region, law_ref, note)
select s.id, 'season', v.s, v.e, v.region, '내수면어업법 시행령 별표1', null
from (values
  ('0420', '0530', '전남·광주·전북·경북·경남 하천'),
  ('0510', '0620', '전남·광주·전북·경북·경남 댐·호소'),
  ('0501', '0610', '그 외 지역 하천'),
  ('0520', '0630', '그 외 지역 댐·호소')
) as v(s, e, region)
cross join (select id from public.species where name_ko = '쏘가리') s;

-- 2) 새 규칙 (재실행 안전: 해당 어종·유형만 지우고 다시)
delete from public.closed_season_rules r
using public.species s
where r.species_id = s.id
  and ((s.name_ko = '쥐노래미' and r.rule_type = 'season')
    or (s.name_ko in ('도다리', '가자미', '민어', '방어')));

insert into public.closed_season_rules (species_id, rule_type, start_mmdd, end_mmdd, min_size_cm, measure, law_ref, note)
select s.id, v.rule_type, v.s, v.e, v.cm, v.measure, v.law_ref, v.note
from (values
  ('쥐노래미', 'season',   '1101', '1231', null::int, null,   '수산자원관리법 시행령 별표1', '백령·대청·소청도 주변 해역은 11.15~12.14'),
  ('도다리',   'season',   '1201', '0131', null,      null,   '수산자원관리법 시행령 별표1', '문치가자미'),
  ('도다리',   'min_size', null,   null,   20,        '전장', '수산자원관리법 시행령 별표2', '문치가자미'),
  ('가자미',   'min_size', null,   null,   20,        '전장', '수산자원관리법 시행령 별표2', '참가자미·용가자미·기름가자미 기준'),
  ('민어',     'min_size', null,   null,   33,        '전장', '수산자원관리법 시행령 별표2', null),
  ('방어',     'min_size', null,   null,   30,        '전장', '수산자원관리법 시행령 별표2', null)
) as v(name, rule_type, s, e, cm, measure, law_ref, note)
join public.species s on s.name_ko = v.name;

-- 3) 비고 보완
update public.closed_season_rules set note = '북위 33도 이북 해역. 근해채낚기·연안복합어업 등 일부 업종만 예외'
where rule_type = 'season' and species_id = (select id from public.species where name_ko = '갈치');

update public.closed_season_rules set note = '2026년은 5.1~5.31 (해양수산부 고시 제2024-40호)'
where rule_type = 'notice' and species_id = (select id from public.species where name_ko = '고등어');
