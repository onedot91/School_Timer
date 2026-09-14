# Netlify 배포

`dist` 폴더만 업로드하면 서버 API가 배포되지 않습니다. 저장소 루트에서 `netlify.toml`과 `netlify/functions/api.mts`를 포함해 빌드해야 합니다.

로컬에서 Functions까지 확인할 때는 Netlify Dev를 8888 포트로 실행합니다. Vite의 `/api` 프록시는 기본적으로 `http://localhost:8888`을 사용하며, 필요한 경우에만 `NETLIFY_DEV_API_URL`로 바꿉니다.

## 기존 데이터 연결

Netlify 환경변수에 현재 운영 중인 **동일한 Supabase 프로젝트**의 값을 설정합니다. 새 데이터베이스 생성, SQL 초기화, 기본값 저장은 하지 않습니다.

| 이름 | 용도 / 범위 |
| --- | --- |
| `VITE_SUPABASE_URL` | 기존 프로젝트 URL / Builds, Functions |
| `VITE_SUPABASE_ANON_KEY` | 기존 공개 anon key / Builds |
| `SUPABASE_URL` | 기존 프로젝트 URL / Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | 기존 서버 전용 key / Functions |
| `DEVICE_SESSION_SECRET` | 서버 세션 서명 secret / Functions |
| `DEVICE_REGISTRATION_KEY` | 기존 교사 기기 등록 key / Functions |
| `STORAGE_PROTOCOL_VERSION` | 현재 운영값 / Functions |
| `STORAGE_REQUIRE_EDIT_REVISIONS` | 기존 설정을 보존하되 기본값은 `1` / Functions |

서버 비밀값에 `VITE_` 접두사를 붙이거나 채팅·소스·로그에 복사하지 않습니다. 환경변수 설정 후 다시 빌드·배포합니다. Functions 지역은 가능한 경우 서울 데이터베이스와 가까운 지역을 선택하고 실제 응답 시간을 확인합니다.

## 검증

### Functions 지역과 응답 시간

2026-09-14 공개 `/api/device-session` 응답의 `X-School-Function-Region`은 `us-east-1`이었고, 기존 Supabase 프로젝트는 서울(`ap-northeast-2`)입니다. 서로 먼 지역을 오가는 요청은 조회 지연을 늘릴 수 있습니다. 지역 변경은 사용자가 직접 수행하며, 데이터베이스나 인증 환경변수는 변경하지 않습니다.

1. Netlify의 **Project configuration → Build & deploy → Continuous deployment → Functions region**에서 지역 선택 가능 여부를 확인합니다. 공식 문서상 Pro/Enterprise 기능이며 현재 요금제는 별도 확인이 필요합니다.
2. 선택할 수 있다면 **Asia Pacific (Tokyo)**(`nrt`, AWS `ap-northeast-1`)를 선택하고 사용자가 재배포합니다. 서울은 현재 셀프서비스 목록에 없습니다.
3. 배포 뒤 다음 명령으로 응답 헤더를 확인합니다. 인증 없는 `401`은 정상이며 학생 기록을 조회하지 않습니다.

   ```sh
   curl -sS -D - -o /dev/null https://effortless-cuchufli-fd6fcd.netlify.app/api/device-session
   ```

4. `X-School-Function-Region`이 `ap-northeast-1`로 바뀌었는지 확인합니다. `Server-Timing`의 `app`은 함수 처리 시간, `storage`는 계측된 저장소 RPC 시간입니다. 인증 없는 위 요청은 DB 속도 측정용이 아닙니다.
5. 배포 전후 같은 학생 수에서 기록 조회 응답 시간과 502/타임아웃 비율을 비교합니다. 저장 검증은 별도 테스트 데이터로 수행합니다. 악화되면 기존 지역으로 되돌려 재배포합니다. 이전 배포는 당시 지역을 유지합니다.

지역 변경 자체가 저장 성공을 보장하지는 않습니다. 로딩 시간 제한, 저장 요청 ID, 저장 결과 확인, 재시도 간격은 유지합니다.

공식 설정 문서: https://docs.netlify.com/build/functions/configuration/#region

### 배포 확인

- `/api/device-session`: 미등록 기기에서 JSON `401 DEVICE_REGISTRATION_REQUIRED`. `404`/HTML은 서버 배포 누락, `503`은 서버 설정 누락입니다.
- 새 주소는 별도 쿠키와 localStorage를 사용하므로 기기 등록이 다시 필요합니다.
- 등록 후 기존 학급 기록을 조회합니다. 브라우저에만 저장돼 있던 데이터는 주소 변경으로 자동 이동하지 않습니다.
- 운영 학생 기록을 테스트로 수정하지 않습니다. 저장 검증은 별도 테스트 DB에서 진행합니다.
- `STORAGE_PROTOCOL_VERSION`을 임의로 변경하거나 데이터를 빈 화면의 기본값으로 덮어쓰지 않습니다.
- 외부 `librarylibrary.vercel.app` iframe은 학교망 차단이 별도로 남을 수 있습니다.

공식 문서: https://docs.netlify.com/build/functions/get-started/
