# 오늘낚시 (Fishing Today)

개인 프로젝트 (153랩). 현위치를 찍으면 날씨·물때가 자동으로 들어가고, 어종·사이즈·마릿수·방법·미끼를 체크하면 기록이 쌓이는 PWA. 기록 + 사진 인증 → 포인트 적립. 공공데이터(바다낚시지수 등)와 사용자 기록으로 출조지를 추천한다.
작업 현황·남은 일은 `docs/HANDOFF.md`, 화면 설계는 `docs/기획서.html`.

## 이름
- 앱: 오늘낚시 (항상 붙여 씀) / 영문 Fishing Today / ID·저장소 `fishingtoday`
- 사업자명(개발자명): 153랩 / 153 Lab / `153lab`
- 스토어 표기: 오늘낚시 - 물때, 날씨, 낚시 기록 / 해시태그 #오낚완

## 스택
- 프론트: Vite + React 19 + TypeScript, react-router, vite-plugin-pwa (Windows 개발 환경, PowerShell)
- 백엔드: Supabase (Postgres + PostGIS, Auth, Storage, Edge Functions/Deno) — https://ooqqvzftomecnylpsary.supabase.co
- 로그인: 카카오 (Supabase 기본 provider, 개인 개발자 비즈앱 전환 + 이메일 동의항목). 네이버는 미구현
- 지도·역지오코딩: 카카오맵 JS SDK (libraries=services)

## 구조
- `supabase/migrations/` 0001~0020. 스키마 변경은 항상 새 번호 파일로 추가하고 `npm run db:push`
- `supabase/functions/`
  - `award_points` 포인트·스코어 적립 (클라이언트는 point_ledger에 직접 못 씀)
  - `weather` 기상청 초단기실황 프록시 (KMA_SERVICE_KEY)
  - `fishing_index` 국립해양조사원 지수 프록시 + 3시간 캐시. gubun: 갯바위·선상(바다낚시지수 fcstFishingv2), 바다여행(fcstSeaTripv2), 선박운항(shipIndex, category=AREA 필수, 좌표 없음 → 함수 안 권역 근사 좌표)
- `supabase/seed_sample.sql` 개발용 샘플(유저 6명·기록 220건, is_sample=true). 서비스 전 삭제
- `scripts/import-spots.mjs` 공공데이터 포인트 CSV → spots (`npm run import:spots -- rock|boat|ground 파일.csv [--dry]`)
- `scripts/import-ban-zones.mjs` 낚시금지구역 Shapefile → fishing_ban_zones (`npm run import:ban-zones -- data/낚시금지구역 [--dry]`)
- 원본 데이터는 `data/` (git 제외). 해수부 공간데이터 좌표계는 EPSG:5179 → proj4로 WGS84 변환
- `src/pages` Home / Search / LogCatch / MyRecords / NicknameSetup(첫 로그인)
- `src/components` MapPicker, HistoryMap, SearchBar, FishingIndexCard, ClosedSeasonCard, SeasonCard, NearbySpotsCard
- `src/lib` supabase, geo, weather, points, records, search, kakaoMap, fishingIndex, rules, profile, seasons, tide(음력 물때)

## 키·시크릿 (값은 절대 코드·채팅·커밋에 넣지 말 것)
- `.env.local` (git 제외): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_KAKAO_JS_KEY
- `supabase/.env` (git 제외, import 스크립트용): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- Supabase 시크릿: KMA_SERVICE_KEY(공공데이터포털, 기상청·해양지수 공용), 선택: KMA_AUTH_KEY, FISHING_INDEX_URL, SEA_TRIP_URL, SHIP_INDEX_URL
- 기상청·공공데이터 키는 프론트에 두지 않는다. 반드시 엣지 함수 경유
- Supabase 시크릿 ANTHROPIC_API_KEY: 엣지 함수 identify_fish(사진 어종 확인)용. 선택: FISH_ID_DAILY_LIMIT
- Open-Meteo(지난 날씨·물때 곡선·시간별 예보·수온·파고)는 키 없이 프론트에서 호출. 무료 API는 비상업 조건 → 상용화 전 기상청·국립해양조사원 API로 교체

## 규칙
- 포인트는 원장(point_ledger) 이력 합산. 잔액 컬럼 금지. 금액은 point_rules 테이블. (user_id, reason, ref_id) 유니크로 중복 적립 방지
- 포인트와 스코어는 분리. 1차는 포인트 적립만, 사용·이벤트는 2차
- catch_logs.log_type: catch / release(방생) / zero(꽝). 별도 테이블 금지
- 자동 입력값(날씨·물때)은 기록 시점 스냅샷으로 catch_logs에 저장
- 다른 사람 기록은 public_catch_v(좌표 500m 반올림)로만 보여준다. 정확한 좌표 노출 금지
- 닉네임은 set_nickname() RPC로만 변경. profiles는 로그인 사용자에게 id·nickname 등 공개 컬럼만 grant (카카오 실명 저장 금지)
- 금어기·금지체장 해당 시 '방생했어요' 체크 전 저장 불가. 법령 값은 안내용, 화면에 '국가법령정보센터 확인' 문구 유지
- 외부 카페·커뮤니티 글 크롤링 금지. 데이터는 사용자 기록·공공데이터·정식 제휴로만
- 엣지 함수는 CORS preflight(OPTIONS) 처리 필수 (빠지면 브라우저에서 'Failed to send a request')
- UI 문구는 한국어 "~해요"체, 버튼은 동작 그대로. 모바일 우선, 하단 탭(홈·검색·기록·랭킹·내 기록)
- 디자인: src/styles.css 변수(토큰)만 사용, 컴포넌트에 색 코드 직접 쓰지 말 것. 어종 그림은 components/FishArt.tsx (species.code 기준)
- 랭킹·스코어용 값(어종·마릿수·크기·시각·위치)은 기록 후 24시간 안에만 수정(0019 트리거). 하루 넘게 지나서 적은 기록·관리자 등록 기록은 포인트·랭킹 제외
- 대화방(community_posts/comments, 0020): 오늘·어종(species.code)·지역(시도 시군구) 방. 신고 3건 자동 숨김, 하루 글 20·댓글 100 제한. 하단 탭 4번째가 대화방(랭킹은 홈에서 진입)
- 관리자 등록 기록은 출처 필수 + '관리자 등록' 표시. 자랑글 링크는 허용 도메인만(is_allowed_share_url), 기록당 1회 50P

## 명령
- 개발: `npm run dev` / 빌드 확인: `npm run build`
- 배포: https://fishingtoday.vercel.app (Vercel, main에 push하면 자동 배포. 환경변수는 VITE_ 3개만)
- DB: `npm run db:push` / 함수: `supabase functions deploy <이름>` / 시크릿: `supabase secrets set KEY=값`
- 작업 후에는 `npm run build`로 타입·빌드 확인하고, 스키마를 바꿨으면 db:push, 함수를 바꿨으면 해당 함수 deploy
