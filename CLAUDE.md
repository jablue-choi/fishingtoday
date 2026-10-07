# 낚시 기록 앱 (fishing)

개인 프로젝트. 현위치를 찍으면 날씨·물때가 자동으로 들어가고, 어종·사이즈·마릿수·방법·미끼를 체크하면 기록이 쌓이는 PWA. 기록 + 사진 인증 → 포인트 적립. 1차는 포인트 **적립까지만**, 사용·이벤트는 2차.

## 스택
- 프론트: Vite + React 19 + TypeScript, react-router, vite-plugin-pwa
- 백엔드: Supabase (Postgres + PostGIS, Auth, Storage, Edge Functions/Deno)
- 프로젝트: https://ooqqvzftomecnylpsary.supabase.co
- 외부 API: 기상청 초단기실황(공공데이터포털), 바다누리 조석(예정), 카카오 로그인

## 구조
- `supabase/migrations/` 스키마. 0001이 전체, 이후 번호 증가. 스키마 변경은 항상 새 마이그레이션 파일로.
- `supabase/functions/award_points/` 포인트 적립 엣지 함수. 클라이언트는 point_ledger에 직접 못 씀(RLS).
- `src/lib/` supabase 클라이언트, 위치(geo), 기상청(weather), 포인트 호출(points)
- `src/pages/` Home / LogCatch / MyRecords

## 규칙 (지켜줘)
- 포인트는 원장(point_ledger) 이력 합산. 잔액 컬럼 만들지 말 것. 적립 금액은 point_rules 테이블.
- 포인트와 스코어는 분리. 포인트 써도 스코어 안 줄어듦.
- catch_logs.log_type: catch / release(방생) / zero(꽝). 별도 테이블 만들지 말 것.
- 자동 입력값(날씨·물때)은 기록 시점 스냅샷으로 catch_logs에 그대로 저장.
- 공개 기록 좌표는 노출 금지. spot_heatmap 뷰(500m 격자)만 사용.
- UI 문구는 한국어, 존댓말 "~해요"체. 버튼은 동작을 그대로 ("저장하고 60P 받기").
- 모바일 우선. 폰 한 손 조작 기준, 하단 탭.

## 1차 작업 순서
1. [x] 스키마 / 골격
2. [ ] 카카오 로그인 동작 확인 (Supabase Auth provider 설정 + 카카오 콘솔 Redirect URI)
3. [ ] Storage 버킷 `catch-photos` 생성 + 정책(본인 폴더만 쓰기)
4. [ ] 현위치 → 기상청 자동 입력 동작 확인
5. [ ] 조과 저장 → award_points → 잔액 갱신 확인
6. [ ] 물때: 바다누리 API → lib/tide.ts, catch_logs.tide_mul 채우기
7. [ ] 금어기 경고 바텀시트 (closed_season_rules 조회, 어종+사이즈 입력 시)
8. [ ] 사진 EXIF 검증 (exifr) → catch_photos.exif_ok 실제 판정
9. [ ] PWA 아이콘 + 폰 설치 테스트 + Vercel 배포
그다음: 추천 / 히트맵 / 주변 편의시설 / 네이버 로그인

## 2차 (아직 하지 말 것)
포인트샵(미끼 교환), 이벤트 응모, 동호회 랭킹

## 명령
npm run dev / npm run db:push / npm run fn:serve / npm run fn:deploy

## 참고 문서
docs/기획서.html (시나리오 + 와이어프레임)
