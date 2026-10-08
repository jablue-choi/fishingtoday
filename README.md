# fishingtoday — 오늘낚시 PWA (153랩)

## 처음 세팅
```bash
npm install
cp .env.example .env.local        # anon key, 기상청 키 채우기
npm i -g supabase
supabase login
supabase link --project-ref ooqqvzftomecnylpsary
supabase db push                  # 스키마 적용
```

## Supabase 대시보드에서 할 일
1. Authentication → Providers → Kakao 켜기 (REST API 키 + Client Secret). 콜백 URL을 카카오 콘솔 Redirect URI에 등록.
2. Storage → New bucket `catch-photos` (private). Policy: `auth.uid()::text = (storage.foldername(name))[1]` 로 본인 폴더만 insert/select.
3. Edge Functions → Secrets 에 `SUPABASE_SERVICE_ROLE_KEY` 는 자동 주입됨. 추가 시크릿 없음.

## 엣지 함수
```bash
cp supabase/.env.example supabase/.env   # 로컬 serve용
npm run fn:serve
npm run fn:deploy
```

## 개발
```bash
npm run dev     # http://localhost:5173
```
폰에서 보려면 `vite --host` 후 같은 와이파이로 접속. 위치·카메라는 https 또는 localhost에서만 동작하므로 폰 테스트는 Vercel 배포 후가 편하다.
