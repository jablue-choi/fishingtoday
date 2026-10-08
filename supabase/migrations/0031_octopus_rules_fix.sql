-- 참문어 규칙 정정
-- 출처: 해양수산부 보도자료(2020.11, "참문어 금어기 신설", 2021.1.1 시행), KDI 경제정보센터 정책자료
--  - 금어기 5.16~6.30 (46일) 유지. 시·도지사가 5.1~9.15 중 46일 이상으로 따로 정할 수 있음
--  - 금지체중: 참문어 300g 조항은 입법예고 후 금어기로 대체되어 없음
--    → 0008의 참문어 600g은 대문어(0030) 값을 잘못 넣은 것이라 삭제
-- ※ 앱 표시는 안내용. 국가법령정보센터·시·도 고시에서 확인

delete from public.closed_season_rules
where rule_type = 'min_weight'
  and species_id = (select id from public.species where name_ko = '참문어');

update public.closed_season_rules
set start_mmdd = '0516', end_mmdd = '0630',
    note = '시·도가 5.1~9.15 중 46일 이상으로 따로 정할 수 있어요'
where rule_type = 'season'
  and species_id = (select id from public.species where name_ko = '참문어');
