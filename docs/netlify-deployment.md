# Netlify 배포

`dist` 폴더만 업로드하면 서버 API가 배포되지 않습니다. 저장소 루트에서 `netlify.toml`과 `netlify/functions/api.mts`를 포함해 빌드해야 합니다.

## 기존 데이터 연결

Netlify 환경변수에 기존 Vercel Production과 **동일한 Supabase 프로젝트**의 값을 설정합니다. 새 데이터베이스 생성, SQL 초기화, 기본값 저장은 하지 않습니다.

| 이름 | 용도 / 범위 |
| --- | --- |
| `VITE_SUPABASE_URL` | 기존 프로젝트 URL / Builds, Functions |
| `VITE_SUPABASE_ANON_KEY` | 기존 공개 anon key / Builds |
| `SUPABASE_URL` | 기존 프로젝트 URL / Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | 기존 서버 전용 key / Functions |
| `DEVICE_SESSION_SECRET` | 서버 세션 서명 secret / Functions |
| `DEVICE_REGISTRATION_KEY` | 기존 교사 기기 등록 key / Functions |
| `STORAGE_PROTOCOL_VERSION` | Vercel Production과 동일한 값 / Functions |
| `STORAGE_REQUIRE_EDIT_REVISIONS` | 기존 설정을 보존하되, Vercel production 기본 동작은 `1` / Functions |

서버 비밀값에 `VITE_` 접두사를 붙이거나 채팅·소스·로그에 복사하지 않습니다. 환경변수 설정 후 다시 빌드·배포합니다. Functions 지역은 가능한 경우 서울 데이터베이스와 가까운 지역을 선택하고 실제 응답 시간을 확인합니다.

## 검증

- `/api/device-session`: 미등록 기기에서 JSON `401 DEVICE_REGISTRATION_REQUIRED`. `404`/HTML은 서버 배포 누락, `503`은 서버 설정 누락입니다.
- 새 주소는 별도 쿠키와 localStorage를 사용하므로 기기 등록이 다시 필요합니다.
- 등록 후 기존 학급 기록을 조회합니다. 브라우저에만 저장돼 있던 데이터는 주소 변경으로 자동 이동하지 않습니다.
- 운영 학생 기록을 테스트로 수정하지 않습니다. 저장 검증은 별도 테스트 DB에서 진행합니다.
- `STORAGE_PROTOCOL_VERSION`을 임의로 변경하거나 데이터를 빈 화면의 기본값으로 덮어쓰지 않습니다.
- 외부 `librarylibrary.vercel.app` iframe은 학교망 차단이 별도로 남을 수 있습니다.

공식 문서: https://docs.netlify.com/build/functions/get-started/
