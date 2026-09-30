# 운영 저장 오류 직접 조사 — 2026-09-30

## 확인 범위

사용자의 직접 접속 요청에 따라 연결된 Supabase `School_Timer`와 로그인된 Vercel 프로젝트 로그를 읽기 전용으로 확인했다. `.env.local`의 Supabase URL과 연결 프로젝트 ref가 일치한다. 학생 작성 내용, 잔액, 인증키, 쿠키는 조회 결과에 포함하지 않았다. 운영 쓰기, 알림 확인 처리, DB 설정 변경, 배포는 수행하지 않았다.

## 제공된 요청의 최종 저장 여부

`public.storage_receipts`에서 요청 ID, action, committed_at만 조회했다. 시간은 한국 시각이다.

| 요청 | 오류 발생 | 영수증 저장 시각 | action |
| --- | --- | --- | --- |
| `809e650e-0869-4b8f-b9a4-d427bf37092f` | 12:55:57.617 | 12:56:46.074786 | `student.auction.bid` |
| `efc601d0-5d48-45be-8cf2-038f46d29cca` | 11:38:57.146 | 13:31:00.985139 | `teacher.settings.patch` |

두 요청 모두 저장 완료 영수증이 존재한다. 최초 요청이 늦게 완료됐는지, 같은 requestId의 복구 재전송이 성공했는지는 영수증만으로 알 수 없다. 이후 다른 조작으로 현재 값이 바뀌었을 가능성도 별개다.

## DB 시간 제한 초과

Supabase unified logs의 UTC `02:35:00`~`04:00:00`을 조사했다. Postgres ERROR 중 `statement timeout`이 63건이며 모두 SQLSTATE `57014`였다. UTC `02:35:03`~`02:39:22`에 집중됐다.

| DB 작업 | 시간 제한 초과 |
| --- | ---: |
| `storage_load_scope` | 31 |
| `storage_load_scope_metadata` | 14 |
| 기타 작업 | 18 |

교사 오류 직전에도 `storage_load_scope`의 시간 제한 초과가 UTC `02:38:43.247` 및 `02:38:45.986`에, metadata 조회는 `02:38:48.144`에 발생했다. 요청 본문을 조회하지 않았으므로 특정 DB 로그와 제공된 교사 requestId를 직접 연결한 것은 아니다.

운영 `authenticator`의 설정은 `statement_timeout=8s`, `lock_timeout=8s`다. 서버 저장소 fetch도8초로 제한된다. UTC `02:38`의 성공한 DB 요청조차 metadata 조회 7,796ms, 영수증 조회 7,087ms, scope 조회 7,603ms가 기록됐다. 저장 전 조회 또는 저장 후 화면 조회가 시간 제한을 초과하면 저장 API 전체가 실패할 수 있다.

경매 오류 시각인 UTC `03:55:57`에는 위 DB timeout이 관찰되지 않았다. 조회한 UTC `03:54`〜`03:58`의 storage RPC 로그는 `03:56:04.426`부터 보인다. 클라이언트가 오프라인으로 감지됐다는 제공된 진단과 시간상 일치하지만, 네트워크 단절을 확정하거나 로그 누락 가능성을 배제하지 않는다.

## Vercel 확인과 한계

관리 화면: <https://vercel.com/onedot9191s-projects/school-timer/logs>

- 로그인된 프로젝트 Logs 화면에 직접 접속했다.
- 최근 로그에서 `/api/shared-settings` 및 `/api/save-alerts`의200응답을 확인했다. 이 관찰은 과거 오류 해결의 증거가 아니다.
- 조회 기간 선택에서 Last 12 hours/Last day는 Upgrade to Pro로 표시됐다.
- 12:50 시작 범위를 지정했을 때 `Outside of allowed range`가 표시됐다. 제공된 두 최초 오류 시각의 Vercel 상세 로그는 확인하지 못했다.
- 허용되는13:30〜13:35범위도 관리 화면에 `Failed to load data, retrying…` 및 필터 결과 조회 실패가 표시되어 요청 상세를 확인하지 못했다.

## 다음 수정 대상

진단 코드 보존만으로 DB 시간 제한 초과는 해결되지 않는다. `storage_load_scope`/metadata 조회의 실행 계획과 동시 조회 부하를 줄이는 수정이 필요하다. 단순한 timeout 증가는 현재 확인된 반복 조회 부담을 해결하지 않는다. DB 함수 변경은 저장 범위·revision·readVersion·삭제 표식 계약을 보존하고, 합성 데이터에서 단독/동시 실행의 변경 전후 시간을 비교한 뒤 별도 승인을 받아 적용해야 한다.

CPU 부족, 연결 대기, 특정 쿼리의 실행 계획, 잠금 대기 중 어느 요인이 주원인인지는 이번 조사로 확정하지 않았다. 운영 부하 테스트는 하지 않았다.
