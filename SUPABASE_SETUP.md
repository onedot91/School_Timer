# Supabase shared settings setup

이 앱은 모든 PC가 같은 설정을 쓰도록 Supabase의 `app_settings` 테이블 한 줄을 공유합니다.

## 내가 이미 준비한 것

- 앱에서 Supabase 설정을 불러오고 저장하는 코드
- `@supabase/supabase-js` 설치
- Supabase 테이블 생성 SQL: `supabase/app_settings.sql`
- 환경변수 예시: `.env.example`

## 사용자가 할 일

### 1. Supabase 프로젝트 만들기

1. https://supabase.com 에 접속합니다.
2. 새 프로젝트를 만듭니다.
3. 프로젝트가 생성될 때까지 기다립니다.

### 2. 테이블 만들기

1. Supabase 프로젝트에서 `SQL Editor`를 엽니다.
2. `supabase/app_settings.sql` 파일 내용을 복사합니다.
3. SQL Editor에 붙여넣고 실행합니다.

### 3. API 키 복사하기

Supabase 프로젝트에서 `Project Settings` -> `API`로 이동한 뒤 아래 값을 복사합니다.

- `Project URL`
- `anon public` key

### 4. 로컬 환경변수 만들기

프로젝트 루트에 `.env` 파일을 만들고 아래처럼 입력합니다.

```env
VITE_SUPABASE_URL=여기에_Project_URL
VITE_SUPABASE_ANON_KEY=여기에_anon_public_key
```

### 5. 앱 다시 실행하기

```bash
npm run dev
```

이후 한 PC에서 설정을 바꾸면 다른 PC에서도 같은 Supabase 프로젝트를 바라볼 때 동일한 설정을 불러옵니다.

## 주의

- `.env` 파일은 Git에 올리지 마세요.
- 같은 설정을 공유하려는 모든 PC는 같은 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 써야 합니다.
- Supabase 환경변수가 없으면 앱은 기존처럼 브라우저 로컬 저장소만 사용합니다.
