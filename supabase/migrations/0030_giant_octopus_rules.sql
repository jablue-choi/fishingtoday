-- 대문어 금지체중 600g
-- 출처: 수산자원관리법 시행령 별표2 (2021 개정으로 400g → 600g 상향, 데일리안 보도 교차 확인)
--       대문어만의 전국 금어기는 확인되지 않음 (지자체 별도 규정은 시·도에서 확인)
-- ※ 앱 표시는 안내용. 국가법령정보센터에서 확인
-- 재실행 안전: 대문어 규칙만 지우고 다시 넣음

delete from public.closed_season_rules
where species_id = (select id from public.species where name_ko = '대문어');

insert into public.closed_season_rules (species_id, rule_type, start_mmdd, end_mmdd, min_size_cm, min_weight_g, measure, region, law_ref, note)
select s.id, 'min_weight', null, null, null, 600, '체중', null, '수산자원관리법 시행령 별표2', null
from public.species s where s.name_ko = '대문어';
