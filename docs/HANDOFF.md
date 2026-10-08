# 오늘낚시 작업 현황 (2026-10-07 시작, 마지막 갱신 2026-10-09)

## 완료된 것
| 영역 | 내용 | 관련 파일 |
|---|---|---|
| 기획 | 페르소나·유저 시나리오·유저 플로우·화면 11개 와이어프레임 | docs/기획서.html |
| 이름 | 오늘낚시 / Fishing Today, 사업자명 153랩 | CLAUDE.md |
| DB | 프로필·조과·사진·포인트 원장·스코어·배지·스팟·편의시설·금어기 | migrations 0001~0008 |
| 로그인 | 카카오 로그인 동작 확인 | src/lib/supabase.ts |
| 기록 | 현위치 → 카카오맵 핀 이동 → 기상청 날씨 자동 입력 → 어종·사이즈·방법·미끼 체크 → 사진 → 저장 | src/pages/LogCatch.tsx |
| 지역명 | 저장 시 카카오 Geocoder로 region 저장, 공개 체크박스(기본 ON, 500m 범위 공개) | LogCatch, kakaoMap.ts |
| 포인트 | award_points: 기본 20 / 사진 30 / 첫 방문 10 / 방생 30 / 꽝 5, 하루 200P 상한 | functions/award_points |
| 내 기록 | 리포트(출조·마릿수·꽝 비율·어종·방법·미끼·월별) / 방문 지도 / 목록, 기간 필터 | MyRecords.tsx, records.ts, HistoryMap.tsx |
| 검색 | 상단 검색창, 지역·어종·추천(최근 14일) 탭, 최근 검색어 | Search.tsx, search.ts |
| 공공데이터 | 바다낚시지수(갯바위·선상), 바다여행지수, 선박운항지수(선상 탭) — 홈 카드, 장소 중복 제거 | functions/fishing_index, FishingIndexCard.tsx |
| 포인트 데이터 | 갯바위·선상 낚시포인트, 전국낚시터 CSV 가져오기 스크립트 (아직 실제 CSV 미적재) | scripts/import-spots.mjs |
| 금어기 | 32개 규칙(2026-10-09 시행령 원문 대조), 홈 카드, 어종 칩 표시, 저장 시 방생 강제 | 0008·0029~0032, rules.ts, ClosedSeasonCard.tsx |
| 샘플 | 샘플 유저 6명·기록 220건 | supabase/seed_sample.sql |
| 닉네임 | 가입 시 임의 닉네임, 첫 로그인 닉네임 설정 화면, set_nickname()로만 변경, anon은 profiles·public_catch_v 조회 불가 | 0009, NicknameSetup.tsx, profile.ts |
| 제철 어종 | species_seasons 33종·58건(0028 보강), 금어기 제외·제철 우선·최근 30일 조황순, 해역 추정(서해/남해/동해/제주/민물), 홈·검색 추천 탭 카드 | 0010, seasons.ts, SeasonCard.tsx |
| 아이콘 | 시안 여러 개(찌, 사람, 낚싯대+물고기 반잠김 등). 최종 미선택, 현재 public/ 아이콘은 임시 | public/icon-*.png |

## 2026-10-08 추가 완료 (0013~0019)
- 디자인: '부표 오렌지 · 해양 대시보드' 스타일, 로고·PWA 아이콘, 다크/라이트/시스템 테마(설정), 5칸 하단 탭
- 홈: 기준 위치 상단 바, 물때 카드(물때 곡선·만조/간조·수온·파고·풍속·기압, Open-Meteo 참고값), 12시간 예보, 지역 낚시지수, 오늘의 낚시왕, 지역별 잘 잡히는 어종, 제철 어종, 포인트 지수
- 기록: 언제→어디서(장소 검색)→무엇을→자세히 단계형, 지난 조과 기록(그날 날씨, 하루 넘게 지난 기록은 포인트 없음), 사진 어종 확인(identify_fish, ANTHROPIC_API_KEY 필요), 어종 추가(코드 u<id>), 어종 일러스트(FishArt)
- 내 기록: 기록 수정 화면(24시간 제한), 자랑글 링크 +50P, 어종별 리포트 그림
- 검색: 지역·어종 통합 검색(검색어 분기, 장소 근처 15km), 내 위치 거리·가까운 순
- 랭킹: 낚시왕(오늘·주·월), 지역별 어종 / 관리자 조과 등록(출처 필수) / 낚시금지구역 경고 / 마스터 테이블 쓰기 차단(0015)
- 대화방(0020): 오늘·어종·지역 질문/댓글, 신고 자동 숨김, 작성 제한. 다음 후보: 채택 답변 포인트, 관리자 신고 목록, 실시간 새 댓글, 약관·방침에 게시물 처리 기준
- 욕설 금지(0021), 회원 차단·관리자 회원/신고 관리(0022), 주변 편의시설 화장실·낚시점·미끼·맛집 + 제보 포인트(0023), 피드 장비·레시피·유튜브(0024)
- 화장실 데이터: data.go.kr 표준데이터 CSV에 좌표가 없어 카카오 REST로 주소 변환 적재 중(해안 지역 먼저). `npm run import:toilets -- data/공중화장실정보.csv --only ...` 다시 실행하면 이어서

## 2026-10-09 추가 완료 (0028~0032, 전부 원격 적용·배포)
- **카카오 로그인 리다이렉트**: 카톡 링크로 열면 'Vercel 로그인' 화면이 뜨던 문제 해결(사용자 확인).
  - 원인: Supabase Site URL이 보호 걸린 `https://fishingtoday-153lab.vercel.app/`이고 Redirect URLs의 운영 주소는 `https://fishingtoday.vercel.app`(끝 '/' 없이)뿐 → 하위 경로·끝 '/' 주소는 Site URL로 떨어짐
  - 수정(src/lib/supabase.ts, auth.tsx): redirectTo는 `window.location.origin` 고정, 보던 경로는 localStorage `login_return`(10분)에 저장 후 로그인 뒤 이동. 해시·이전 오류 파라미터 제거. 카톡 인앱 브라우저는 `kakaotalk://web/openExternal`로 외부 브라우저에서 열고 `?login=kakao`로 로그인 이어가기
  - **남은 것(대시보드)**: Site URL → `https://fishingtoday.vercel.app`, Redirect URLs에 `https://fishingtoday.vercel.app/**` 추가. `supabase config push`는 로컬 config.toml이 원격과 크게 달라(카카오 provider 등) 쓰지 말 것
- **조석예보 연동**: 엣지 함수 `tide`(국립해양조사원 조석예보 고·저조, 공공데이터포털 `1192136/tideFcstHghLw/GetTideFcstHghLwApiService`, KMA_SERVICE_KEY로 승인됨).
  - `obsCode` 필수 → 같은 API로 코드를 훑어 만든 지점 175곳(DT_ 관측소·SO_ 예보지점·IE_ 기지) `functions/tide/stations.ts`에서 가장 가까운 곳 선택
  - `extrSe`는 그날 순번이라 만조·간조는 앞뒤 조위로 판정. 지점·날짜별 24시간 캐시(fishing_index_cache, gubun `조석:코드:날짜`)
  - 홈 TideHero 만조·간조·곡선(고·저조 코사인 보간)과 기록 high_tide_at/low_tide_at 스냅샷. 40km 밖·실패 시 Open-Meteo로 대체
  - 바다타임과 −25분 차이 나던 건 Open-Meteo 모델값 때문. 바다타임 데이터 직접 수집은 규칙(크롤링 금지)상 하지 않음
- **일출·일몰**: src/lib/sun.ts(SunCalc 방식 계산, API 없음, 오차 1분 안팎), 홈 물때 카드에 표시
- **제철 어종 보강(0028)**: 수산자원공단 낚시어선 어획량 조사(갈치 3년 연속 1위)·해경 낚시어선 주어업지 CSV 집계 기준. 새 어종 10종(갈치·방어·부시리·한치·가자미·도다리·열기·임연수어·민어·대문어, FishArt 그림 포함), species_seasons 31→58건. 방법·미끼·팁은 공식 근거 약함 → 문구 검수 필요. 뺀 어종: 보구치·꼴뚜기·다금바리·빙어(근거 약함), 황돔은 참돔으로 봄
- **금어기·금지체장 법령 대조(0029~0032)**: 국가법령정보센터 시행령 원문(2026.7.1 시행, 별표1 개정 2026.6.23·별표2 개정 2024.6.4)과 대조. 규칙 32건
  - 추가: 갈치 7.1~7.31(북위 33도 이북)·항문장 18cm, 대문어 600g, 쥐노래미 금어기 11.1~12.31, 도다리 12.1~1.31·20cm, 가자미 20cm, 민어 33cm, 방어 30cm
  - 정정: 참문어 금지체중 600g 삭제(참문어는 금어기만, 600g은 대문어), 쏘가리 금어기를 권역×하천/댐·호소 4구간으로(`region` 컬럼 사용)
  - 앱: 금지체장은 법령대로 'n cm **이하**' 판정(`<=`). region 있는 금어기는 막지 않고 안내만, 제철 추천에서도 빼지 않음
  - 확인 못 한 것: 시·도 강화 고시(법 제14조④), 2027 고등어 금어기 고시, 2026.6.24 해수부 유예 발표 원문(언론 보도로만 확인, 근해연승 업종 한정이라 낚시 무관)
- 남은 것: 사진 EXIF 검증, Open-Meteo 상용 대체(수온·파고·바람·시간별 예보), 선상 CSV·낚시터 지오코딩, 네이버 로그인, 샘플 데이터 삭제, 갈치 금지체장은 항문장 기준인데 사용자는 전장을 적어 비교가 느슨함
- 해경 낚시어선 주어업지 CSV 원본은 세션 임시 폴더에만 있음(프로젝트 data/로 옮기지 않음)

## 로컬에서 먼저 확인할 것 — 2026-10-08 전부 확인 완료 (0001~0010 원격 적용, 함수 3개 최신 배포, 샘플 적재)
1. 위 파일들이 다 있는지, `npm run build` 통과하는지
2. `supabase migration list`로 0001~0008이 원격에 적용됐는지 → 아니면 `npm run db:push`
3. 함수 3개(award_points, weather, fishing_index) 최신본 배포 → `supabase functions deploy <이름>`
4. award_points CORS 수정본이 배포됐는지: `curl.exe -i -X OPTIONS https://ooqqvzftomecnylpsary.supabase.co/functions/v1/award_points` → 200이어야 함
5. 카카오맵 401 해결됐는지 (JavaScript 키에 http://localhost:5173 도메인 등록, 카카오맵 사용 설정 ON)
6. seed_sample.sql을 SQL Editor로 넣었는지 (검색 탭에 다른 사람 기록이 보이면 OK)

## 알려진 문제 / 해야 할 것 (우선순위 순)
1. ~~시즌별 추천 어종~~ 완료 (0010)
2. ~~실명 노출~~ 완료 (0009)
3. ~~좌표 노출 구멍~~ 완료 (0011: catch_logs 본인만, public_catch_v 소유자 권한 뷰, anon 기록 조회 차단)
4. 물때: tide_mul은 음력(Intl dangi)으로 계산해 저장 완료 (src/lib/tide.ts, 서해 7물때식·그 외 8물때식, 홈·기록 화면 표시). 만조·간조는 2026-10-09 국립해양조사원 조석예보(고·저조) 연동 완료(엣지 함수 tide, 홈 물때 카드·기록 high_tide_at/low_tide_at). 관리자 등록도 0033에서 만조·간조 저장
5. 사진 EXIF 검증(exifr): 지금은 업로드만 하면 exif_ok=true
6. ~~적립 사유 한글 라벨~~ 완료 (lib/points.ts reasonLabel)
7. 포인트 데이터: 갯바위 CSV 1076건 적재 완료(mof_rock, 공간정보 EPSG:5179 → proj4 변환). 바다낚시지수 예보 지점은 fishing_index 함수가 캐시 갱신 때 spots에 동기화(khoa_rock/khoa_boat). 홈 "주변 낚시 포인트" 카드(spots_near). **남은 것**: 선상 CSV(boat), 낚시터.csv는 허가 현황이라 좌표 없음 → 카카오 로컬 REST로 주소 지오코딩 필요(허가 종료 행 제외)
7-1. 낚시금지구역: 국립해양조사원 전자해도 제한구역 Shapefile 25건 적재(0012, scripts/import-ban-zones.mjs). 기록 화면에서 핀이 구역 안이면 경고. 지자체 낚시통제구역은 미포함
8. 아이콘 최종 선택 → public/ 교체
9. ~~Vercel 배포~~ 완료 (2026-10-08) https://fishingtoday.vercel.app — main push 시 자동 배포, vercel.json SPA rewrite, 카카오 도메인·Supabase URL Configuration 등록, 폰 로그인·지도·설치 확인
10. 네이버 로그인 (Supabase 기본 provider 아님 → 엣지 함수로 OAuth 처리)

## (완료) 시즌별 추천 어종 스펙 — 0009 대신 0010으로 구현
- 목적: "이번 달 뭐 잡으러 갈까?"에 답하기. 홈 카드 + 검색 추천 탭에 노출
- 데이터: 새 마이그레이션 0009
  - `species_seasons`(species_id, area: 서해/남해/동해/제주/민물, months int[], peak_months int[], methods text[], baits text[], tip text)
  - 주요 어종 20여 종 시드: 주꾸미·갑오징어(서해 가을), 우럭·광어(서해 봄~가을), 감성돔(남해 가을~겨울, 5월 금어기), 무늬오징어(남해·제주 가을), 고등어·전갱이·학꽁치(동해·남해 가을), 볼락(겨울~봄), 삼치(가을), 망둥어(서해 가을), 벵에돔(제주·남해 여름~가을), 대구(동해 겨울), 붕어·배스(민물 봄·가을) 등
- 로직
  - 이번 달이 months에 있으면 후보, peak_months면 "제철"
  - **금어기인 어종은 제외** (rules.ts inPeriod 재사용), 곧 금어기면 "D-n 금어기 시작" 표시
  - 사용자 기록 반영: public_catch_v 최근 30일 해당 어종 마릿수로 정렬 가중치
  - 위치(getLastPos)로 area 추정: 서해/남해/동해/제주 (경도·위도 경계로 단순 판정)
- UI: 홈 "이번 달 제철 어종" 카드(어종명, 제철 배지, 추천 방법·미끼, 최근 조황 n마리) → 누르면 /search?mode=species&q=어종
- 계절 데이터 값은 안내용이므로 화면에 "지역·수온에 따라 달라요" 문구

## 나중에 (2차 이후)
- 포인트샵(제휴 낚시점 바코드 쿠폰 미끼 교환), 이벤트 응모, 동호회 랭킹
- 위치 기반 1일 1회 푸시 (토스페이처럼 낚시터·바다 근처 진입 시) — PWA로 불가, Capacitor 등 네이티브 전환 필요
- 강나루/바다나루처럼 민물·바다 모드 분리 검토
- 도메인 joyluck.kr 등은 이름 변경으로 보류, 필요 시 fishingtoday 계열로 재검토
- 레드펄스 바다낚시 카페: 크롤링 대신 매니저에게 제휴 제안, 회원 베타테스터 초대
