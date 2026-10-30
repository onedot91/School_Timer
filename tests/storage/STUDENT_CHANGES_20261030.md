# 학생 화면: 바뀐 부분만 다시 읽기 (2026-10-30)

## 문제

학생 화면의 읽기 버전은 학급 전체의 마지막 저장 시각을 포함한다. 그래서 누가 무엇을 저장하든 학생 23명이 자기 읽기 범위 전체를 다시 읽었다.
운영 측정으로 학생 한 명의 전체 읽기는 1,287KB였고, 11:10~11:40 수업에서 144회 일어났다(`docs/db-stall-2026-10-30.md`).

## 변경

- `supabase/storage_student_changes.sql`
  - `storage_scope_selector_manifest(scope)`: 읽기 범위의 항목(경로)마다, 그리고 지갑마다 요약값(md5)을 만든다. 항목 요약은 해당 행의 키·revision·삭제 여부로 만들어 삭제도 잡는다.
  - `storage_load_scope_changes(scope, known)`: `known`이 없으면 전체와 요약을 준다. 있으면 요약이 다른 항목과 지갑만 `storage_load_scope`로 읽는다. 폴링이 비교하는 `readVersion`은 범위 전체 값으로 돌려준다.
  - `storage_load_scope_changes_student`: 기존 학생 읽기와 같은 학급 단위 슬롯(동시 2개)을 쓴다. 세 함수 모두 `service_role` 전용이다.
- 서버(`STORAGE_STUDENT_CHANGES=1`일 때만): 학생 GET에 `X-Storage-Changes: 1`이 오면 위 함수를 쓴다. `X-Storage-Read-Manifest`는 그 학생의 읽기 항목과 본인 지갑 키만 허용하고, 다른 키는 400으로 거절한다. 테스트 학생(24)과 개요 읽기는 기존 경로를 쓴다.
- 화면: 학생 전체 읽기에 `X-Storage-Changes: 1`과 마지막으로 받은 요약을 보낸다. 받은 부분은 기존 저장소 투영 캐시(`StorageProjectionPatchCache`)에 합친다. 다른 학생으로 바뀌면 요약을 버리고 전체부터 다시 읽는다. 서버 변수가 꺼져 있으면 요청이 무시되어 기존과 같이 전체를 읽는다.

## 측정 (로컬, 운영 크기 합성 데이터: 학생 읽기 2MB)

| 경우 | 기존 전체 다시 읽기 | 바뀐 부분만 |
|---|---:|---:|
| 바뀐 것 없음 | 2,042KB, 30.8ms | 2KB, 18.0ms |
| 입찰가만 바뀜 | 2,042KB | 3KB, 18.4ms |
| 입찰 + 입찰 기록 추가 | 2,042KB | 599KB, 22.9ms |

실제 입찰은 입찰 기록도 함께 늘므로 마지막 줄이 보통이다. 입찰 기록 항목은 모든 물품을 한 번에 다시 보낸다
(운영 크기 233KB). 물품별로 나누면 더 줄일 수 있으나 요약 개수 제한(256)과 헤더 크기 때문에 이번에는 하지 않았다.
운영 응답 시간은 배포 뒤 수업에서 다시 잰다.

## 검증

- `tests/storage/studentChanges.integration.test.ts`(필수 저장 회귀): 첫 읽기는 전체+요약, 변화 없음·다른 학생 입찰·다른 학생 개인 자료·공용 자료 삭제·본인 지갑·본인 편지 각각에서 "전체 1회 + 바뀐 부분"을 합친 결과가 새 전체 읽기와 같다. 다른 학생 지갑·범위 밖 키가 든 요약은 400. 변수를 끄면 기존 경로. 권한. SQL 재적용 시 함수 계약 동일.
- `src/lib/progressiveSettingsRead.test.ts`: 요약 보관·전송, 부분 병합, 캐시 무효화 뒤 유지, 개요 읽기 제외, 학생 전환 시 초기화.

## 운영 반영 순서

1. Supabase에 `supabase/storage_student_changes.sql` 적용. 새 함수만 추가한다.
2. Vercel Production 서버 환경변수 `STORAGE_STUDENT_CHANGES=1`.
3. 배포.

되돌리기: 변수를 `0`으로 바꿔 재배포. 화면은 요약 없이 전체 읽기로 돌아간다. SQL 함수는 지울 필요가 없다.
