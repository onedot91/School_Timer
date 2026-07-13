<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# School Timer

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7afc0c45-932b-42d8-bbda-7fc70632641a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

If Chrome closes unexpectedly while code is being edited, run the app without
Vite HMR:
   `npm run dev:stable`

## Deploy

기본 화면은 API 키 없이 실행할 수 있습니다. Supabase 공유 설정과 주간 미션 자동 지급을 사용하려면 다음 환경변수가 필요합니다.

```env
VITE_SUPABASE_URL=Supabase_Project_URL
VITE_SUPABASE_ANON_KEY=Supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=Supabase_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY`는 Vercel의 서버 환경변수에만 저장하며 `VITE_` 접두사를 붙이지 않습니다.
