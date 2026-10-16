# Supabase shared settings setup

이 앱은 모든 PC가 같은 설정을 쓰도록 Supabase의 `app_settings` 테이블 한 줄을 공유합니다.
알림장은 `announcement_notes` 테이블에 날짜별로 한 줄씩 누적 저장합니다.

## 내가 이미 준비한 것

- 앱에서 Supabase 설정을 불러오고 저장하는 코드
- `@supabase/supabase-js` 설치
- Supabase 테이블 생성 SQL: `supabase/app_settings.sql`
- ㄱㄴㄷ 낱말판 전용 테이블 SQL: `supabase/classword.sql`
- 환경변수 예시: `.env.example`

## 사용자가 할 일

### 1. Supabase 프로젝트 만들기

1. https://supabase.com 에 접속합니다.
2. 새 프로젝트를 만듭니다.
3. 프로젝트가 생성될 때까지 기다립니다.

### 2. 테이블 만들기

1. Supabase 프로젝트에서 `SQL Editor`를 엽니다.
2. `supabase/app_settings.sql` 파일 내용을 복사해 실행합니다.
3. 이어서 `supabase/classword.sql` 파일 내용도 복사해 실행합니다.

이미 이전 설정 테이블을 만들었더라도 같은 파일을 다시 실행하면 됩니다. 알림장과 주간 미션 지급 기록 테이블, 중복 지급 방지 함수가 함께 추가됩니다.
보안 규칙이나 함수가 변경된 뒤에도 이 SQL을 다시 실행해야 실제 Supabase 프로젝트에 최신 권한과 입력 제한이 적용됩니다.
`classword.sql`은 기존 설정·고마·미션 기록을 수정하지 않고 `classword_rounds`, `classword_entries` 전용 테이블과 제약만 추가합니다. 외부 Classword 데이터는 자동으로 가져오지 않습니다.

낱말 항목(`classword_entries`)은 오늘을 포함한 최근 14일만 유지되며, 정상적으로 인증된 낱말판 API 요청 시 더 오래된 항목이 자동 삭제됩니다. 날짜별 주제(`classword_rounds`)와 기존 고마·미션 보상 기록은 삭제하지 않습니다.

### 3. API 키 복사하기

Supabase 프로젝트에서 `Project Settings` -> `API`로 이동한 뒤 아래 값을 복사합니다.

- `Project URL`
- `anon public` key
- `service_role` key

### 4. 로컬 환경변수 만들기

프로젝트 루트에 `.env` 파일을 만들고 아래처럼 입력합니다.

```env
VITE_SUPABASE_URL=여기에_Project_URL
VITE_SUPABASE_ANON_KEY=여기에_anon_public_key
```

배포 환경에는 아래 서버 전용 변수도 추가합니다.

```env
SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_key
DEVICE_REGISTRATION_KEY=교사만_아는_8자_이상의_기기_승인키
STUDENT_REGISTRATION_KEY=학생에게_알려줄_6자_이상의_학급_코드
DEVICE_SESSION_SECRET=충분히_긴_무작위_문자열_32자_이상
```

세 값은 공유 설정과 주간 미션을 처리하는 서버 함수에서만 사용합니다. 브라우저 코드에 노출되는 `VITE_` 접두사를 붙이면 안 됩니다.
배포된 앱에서 0번(교사)은 `DEVICE_REGISTRATION_KEY`로 기기를 승인합니다. 학생 기기는 처음 한 번만 `STUDENT_REGISTRATION_KEY`(학급 코드)를 입력하고, 이후 번호를 바꿔도 다시 묻지 않습니다. 등록 상태는 브라우저의 `HttpOnly` 쿠키에 저장되며 180일 동안 유지됩니다.

- 학급 코드는 교사 승인 키와 달라야 합니다. 값이 없거나 같으면 학생 등록이 거절됩니다.
- 학급 코드를 처음 적용하면 이미 등록된 학생 기기도 한 번 코드를 다시 입력해야 합니다.
- 학급 코드가 반 밖으로 새면 코드를 바꾸고 `DEVICE_SESSION_SECRET`도 새 값으로 바꿉니다. 그러면 모든 기기 등록이 해제되고 새 코드로 다시 등록해야 합니다.

### 5. 앱 다시 실행하기

```bash
npm run dev
```

이후 한 PC에서 설정을 바꾸면 다른 PC에서도 같은 Supabase 프로젝트를 바라볼 때 동일한 설정을 불러옵니다.
알림장은 같은 날짜에 작성한 내용이 한 기록으로 저장되고, 날짜가 바뀌면 새 기록으로 누적됩니다.

## 주의

- `.env` 파일은 Git에 올리지 마세요.
- `SUPABASE_SERVICE_ROLE_KEY`는 브라우저 코드나 공개 저장소에 절대 넣지 마세요.
- `DEVICE_REGISTRATION_KEY`, `STUDENT_REGISTRATION_KEY`, `DEVICE_SESSION_SECRET`도 Git이나 학생에게 공개하지 마세요.
- 같은 설정을 공유하려는 모든 PC는 같은 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 써야 합니다.
- Supabase 환경변수가 없으면 앱은 기존처럼 브라우저 로컬 저장소만 사용합니다.
