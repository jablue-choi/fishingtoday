-- 갈치 금어기·금지체장
-- 출처: 수산자원관리법 시행령 별표1(금어기 7.1~7.31, 북위 33도 이북 해역)·별표2(금지체장 항문장 18cm)
--       해양수산부 2026.6.24 규제 완화 발표: 근해연승 업종만 2027.6.30까지 금어기 유예 → 낚시는 그대로 적용
-- ※ 앱 표시는 안내용. 국가법령정보센터에서 확인
-- 재실행 안전: 갈치 규칙만 지우고 다시 넣음

delete from public.closed_season_rules
where species_id = (select id from public.species where name_ko = '갈치');

insert into public.closed_season_rules (species_id, rule_type, start_mmdd, end_mmdd, min_size_cm, min_weight_g, measure, region, law_ref, note)
select s.id, r.rule_type, r.s, r.e, r.cm, null, r.measure, null, r.law_ref, r.note
from (values
  ('season',   '0701', '0731', null::int, null,     '수산자원관리법 시행령 별표1', '북위 33도 이북 해역 (제주 남쪽 먼바다 일부 제외)'),
  ('min_size', null,   null,   18,        '항문장', '수산자원관리법 시행령 별표2', '주둥이 끝에서 항문까지 길이')
) as r(rule_type, s, e, cm, measure, law_ref, note)
cross join (select id from public.species where name_ko = '갈치') s;
