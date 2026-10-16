# 운영 안정성 분석과 최우선 개선안

조사일: 2026-10-16, 약 11:20 KST.
대상: School_Timer Supabase 프로젝트와 school-timer Vercel 프로젝트.
운영 조회는 읽기 전용으로 수행했다. 학생 작성 내용, 인증 정보, 개별 잔액은 수집하지 않았다.
운영 설정 변경, 데이터 수정, 배포, 운영 부하 테스트는 실행하지 않았다.

## 판단

최우선 개선은 **운영과 같은 저장 계약을 검증하고, 통과한 코드·DB 조합만 사용자에게 배포 가능 상태로 제공하는 필수 검증 절차**이다.
테스트 명령의 존재와 운영 반영 차단은 서로 다르다. 현재는 전자는 있지만 확인한 배포 설정에 후자가 없다.
이것이 다른 변경보다 우선이라는 판단은 아래 오류 분포와 재현 근거에 따른 것이며, 개선 효과의 수치를 실험으로 확정한 것은 아니다.

## 확인한 사실

### 정상 동작

- Supabase 프로젝트 상태는 `ACTIVE_HEALTHY`, 서울 리전이다. storage_control은 active=true, maintenance=false였다.
- KST 10월 15일 커밋 영수증 416건, 16일 조사 시점 109건이 있었다. 영수증 건수는 전체 HTTP 요청 수가 아니다.
- 잔액과 원장의 합계를 개인정보 없는 집계로 비교했으며 불일치 계정 수는 0이었다.
- 09:20–09:50 KST의 `storage_prepare_command`는 33회, 평균 137.7ms, 최대 533ms였다.
- 같은 구간 `storage_commit_scoped_and_load`는 28회, 평균 211.9ms, 최대 598ms였다.
- 이는 DB RPC 응답 시간이며 브라우저에서 버튼을 누른 뒤 끝날 때까지의 총시간이 아니다. HTTP 200만으로 업무 반영 성공을 모두 판정하지도 않았다.

### 운영이 막히는 경우

`app_settings`의 저장 오류 알림 중 updated_at >= 2026-10-15T00:00:00Z인 보관 행을 집계했다.
개별 요청이 같은 알림으로 합쳐지거나 알림 전송이 실패할 수 있으므로 전체 실패율의 분모로 사용할 수 없다.

| 보관 알림 분류 | 건수 | 관찰 |
| --- | ---: | --- |
| 도서관 STORAGE_SCOPE_VIOLATION | 42 | 10월 15일 09:42–12:45 KST |
| 경매 STORAGE_SCOPE_VIOLATION | 2 | 10월 15일 12:13–12:14 KST |
| 교사 설정 경로 STORAGE_SCOPE_VIOLATION | 5 | 10월 16일 09:42–09:43 KST |
| 오늘의 친구 HTTP 429 | 2 | 요청 제한 |
| 학생 거래 저장 확인 필요 | 1 | 아래 영수증으로 후속 반영 확인 |
| 교사 로컬 초안 CAS 충돌 | 1 | 원격 DB 오류와 구분 |
| 합계 | 53 | 범위 오류 49건, 약 92.5% |

49건이 하나의 버그라는 뜻은 아니다. 도서관·경매 알림은 제공된 최신 배포 시각보다 앞선 오류도 포함한다.
기능별 원인과 해결 상태를 모두 확정하지 않았다. 같은 오류 계열이 여러 기능에서 반복된다는 증거이다.

교사 음수 고마 조정은 로컬 합성 데이터로 같은 HTTP 400을 재현했다.
동작 로직이 경제 상태·알림 편지를 바꾸지만 scope는 잔액 외 쓰기를 허용하지 않았다.
당시 운영의 다섯 요청 action은 알림에 없으며 과거 Vercel 로그도 아래 보관 제한으로 조회하지 못했다.
따라서 재현한 버그와 운영 다섯 건이 정확히 같다는 결론은 보류한다.

6번 학생 요청 `387d4be5-56c6-481d-816c-0875d5f1b236`의 운영 영수증은 다음과 같았다.

- action: student-economy
- applied: true
- committed_at: 2026-10-16T00:38:18.110698Z, KST 09:38:18
- 최초 제공된 오류: KST 09:29:34

같은 요청 ID로 후속 커밋된 사실은 확인했다. 처음 오류 순간에 이미 저장됐다는 증거는 아니며,
최초 원인 `STUDENT_ECONOMY_UPDATE_FAILED`의 내부 예외와 재전송 주체는 확인하지 못했다.

### 지연 문제도 별도로 존재한다

- Vercel 보관 로그에서 10:53:06, 10:53:15, 11:07:28 KST의 `/api/shared-settings` GET이 HTTP 502였다.
- 세 건 모두 snapshot 단계 TimeoutError, elapsedMs=8002였다.
- 상세 요청은 `changes=1`, production 배포 `dpl_6HHs81otn1vLUGTquqXk8C4LxoFj`였고 수신 위치는 서울(icn1)로 표시됐다. 수신 위치만으로 함수 실행 위치를 단정하지 않는다.
- Supabase는 09:30:42–09:30:45 KST에 `storage_load_snapshot` 내부 SQLSTATE 57014를 3건 기록했다. 호출자는 teacher_changes 2건, reward_audit_source 1건이었다.
- 09:20–09:50 KST의 reward_audit_source는 11회, 평균 2222.1ms, 최대 6458ms였다.
- 같은 구간 영수증 확인 RPC 358회에 비해 저장 commit RPC는 28회였다. 확인 요청이 많지만 이것만으로 재시도가 지연의 원인이라고 확정하지 않는다.
- 조사 시 DB 크기는 약 52.6MiB, storage_resources 3700행, wallet_ledger 6411행이었다.
- pg_stat_statements는 8월 6일 초기화 이후 누적 통계다. 당일 통계로 오인하지 않는다.

코드상 보상 감사는 전체 snapshot을 구성하며, 교사 초기·복구 읽기도 전체 snapshot 경로를 사용할 수 있다.
전체 집계와 실시간 저장이 같은 DB를 사용한다. 지연과 오류의 인과관계 및 CPU·I/O·락 중 지배 요인은 추가 측정이 필요하다.
현재 자료는 무조건적인 증설이나 타임아웃 연장을 최우선으로 선택할 근거가 되지 않는다.

## 왜 기존 검증으로 충분하지 않았는가

- Vercel Build and Deployment 화면의 Deployment Checks에 `No checks configured`가 표시됐다.
- Vite 기본 빌드 설정이며 Build Command override는 꺼져 있었다. 기본 안내는 npm run build 또는 vite build다.
- package.json의 build는 vite build다. verify:predeploy와 verify:release는 별도 스크립트이며 build 자체에서 호출하지 않는다.
- 현재 로컬 저장소에 .github 워크플로 폴더가 없다. 별도 외부 CI의 존재까지 부정하는 것은 아니다.
- 실제 PostgreSQL·HTTP·브라우저 검증 도구는 이미 있다. 재활용할 기반은 충분하다.
- 직전 수정에서 기존 테스트가 통과한 상태에서도 새로 추가한 음수 조정 재현 테스트 2건은 수정 전 모두 실패했다.
  수정 후 지갑·예금·투자금·대기 차감 4가지 경로가 통과했다. 테스트 개수보다 업무 조건의 누락이 문제다.
- 기존 verify:release의 별도 Chromium 실행 전제는 현재 프로젝트의 내장 브라우저 검수 정책과 맞지 않는다.
  로컬 화면 검증은 iab 경로로 조정하고, 허용되지 않는 별도 브라우저 실행을 검증 우회책으로 삼지 않아야 한다.

## 하나의 개선: 저장 검증을 통과해야만 운영 반영할 수 있게 한다

검증 단위는 빌드 성공이 아니라 **실제 교사·학생의 행동 결과**다.
합성 데이터로 운영의 코드, RPC 정의, 스키마, 관련 기능 플래그를 재현한 격리 환경에서 수행한다.

필수 합격 기준 제안:

1. 모든 저장 action과 조건 분기를 검증한다. 신규·기존·누락 필드, 지갑·예금·투자금·차감 대기,
   도서 배치 변경, 경매 낙찰·취소 등을 실제 API부터 DB까지 통과시킨다.
   범위 밖 수정은 거절하면서 정상 변경은 허용하고, 다른 학생 데이터가 보존돼야 한다.
2. 학생 23명과 교사 1명의 동시 조작 및 조회·보상 감사가 겹치는 시나리오를 검증한다.
   응답 유실·재연결·동일 ID 재전송에서도 한 번만 반영되고, 영수증으로 결과가 확정돼야 한다.
   실제 데이터는 복사하지 않고 규모·형태만 유사한 합성 데이터와 장기 누적 데이터로 시험한다.
3. 저장 결과·잔액/원장 정합성·시간 예산을 같은 승인 조건으로 묶는다.
   초기 제안은 정상 시나리오 저장 오류 0건, 중복 반영 0건, 타인 데이터 손실 0건,
   저장 완료 p95 2초 이내, 조회 p95 1초 이내, 8초 타임아웃 0건이다.
   이 수치는 현재 달성 사실이 아니라 검증·조정할 목표다.
4. 통과한 commit·산출물·DB 함수/마이그레이션 지문·기능 플래그 조합에만 승인 증거를 발급한다.
   실패·건너뜀·증거 없음·DB 조합 불일치이면 운영 반영을 막는다.
   코드를 고친 뒤 예전 통과 결과를 재사용할 수 없어야 한다.

Vercel Deployment Checks 또는 필수 CI/빌드 검증 경로로 승인 결과를 연결하되,
구체적인 연결 수단은 해당 계정에서 사용할 수 있는 기능을 확인해 결정한다.
기존 스크립트를 선택적으로 실행하자는 제안이 아니라, 검증을 생략한 버전은 운영에 넣을 수 없게 하자는 제안이다.
운영 배포는 기존 원칙대로 사용자가 직접 수행한다. 이번 조사는 이러한 설정을 적용하거나 배포를 실행하지 않았다.

이 절차가 모든 장애를 없애지는 않는다. 외부 장애나 시험에서 빠진 조건은 남는다.
그럼에도 현재 가장 많이 관찰된 저장 계약 오류를 교실 사용 전에 발견하고,
조회 지연도 운영 반영 전에 실패 조건으로 다룬다는 점에서 가장 먼저 투자할 개선으로 판단한다.

## 근거와 조회 한계

- [Vercel 운영 빌드·배포 설정](https://vercel.com/onedot9191s-projects/school-timer/settings/build-and-deployment)
- [Vercel 운영 로그](https://vercel.com/onedot9191s-projects/school-timer/logs)
- [Supabase 프로젝트](https://supabase.com/dashboard/project/dxibhawclfhoabfgwria)
- [Vercel 공식 Deployment Checks 문서](https://vercel.com/docs/deployment-checks)
- [Supabase 공식 테스트 지침](https://supabase.com/docs/guides/local-development/testing/overview)
- 로컬: package.json, dev/verifyRelease.mjs, dev/verifyStorage.mjs,
  src/server/storageCommandScope.ts, src/server/storageV2Repository.ts,
  supabase/storage_progressive_reads.sql, supabase/storage_snapshot_execution.sql.

Supabase 로그 비교는 UTC 2026-10-16 00:20–00:50 및 00:00–02:30을 명시해서 조회했다.
나중 시각까지 지정했어도 조회 당시 아직 발생하지 않은 로그는 포함될 수 없다.
Vercel 화면에서 접근 가능한 로그 기간은 최근 1시간이었고, 더 긴 프리셋에는 업그레이드 안내가 표시됐다.
09:29·09:43 당시 Vercel 예외를 직접 확인했다고 주장하지 않는다.
API 응답 로그와 운영 영수증·알림은 서로 다른 모집단이며 단순 합산해 성공률을 계산하지 않았다.
