# 신문 질문 통합

## 구현 범위

학생은 **미션 → 신문 질문하기**에서 개인·주제 질문을 작성한다. 교사는 **설정 → 학생 생활 → 신문 질문**에서 관리한다. 외부 창이나 iframe을 사용하지 않는다.

- 기존 번호 선택·기기 세션과 학생 번호 재선택 단축키를 그대로 사용한다.
- 개인·주제 질문은 학생/유형/한국 ISO 주차마다 하나씩 저장하며 다시 제출하면 수정한다.
- 주제가 등록된 주에만 주제 입력란을 표시한다. 개인 질문 저장이 먼저 필요하다.
- 60자, 공백, Unicode 문자, 마지막 물음표 한 개를 검사한다. 질문 안경은 시작 단어만 바꾸며 plain text 입력을 유지한다.
- 이번 주 학급 질문, 본인의 전체 기록, 주차 전환, 로컬 초안, 로딩·실패 상태를 제공한다.
- 개인 질문 저장과 기존 15고마 주간 보상을 운영 DB의 한 트랜잭션에서 처리한다. 같은 주 재제출로 중복 지급하지 않는다.
- 교사에게 23명 현황, 주차별 주제, 필터, blur/Enter 수정, 개별 삭제, 확인 문구가 필요한 전체 초기화, 누적/전체 TXT를 제공한다.
- 질문을 수정하면 누적 다운로드 상태가 대기로 돌아간다. 전체 다운로드는 상태를 바꾸지 않는다.
- 왜·만약·거꾸로가 독립 낱말로 쓰이면 문장 안 위치와 관계없이 입력창에서 굵은 빨간색으로 강조하되 저장 문자열은 plain text로 유지한다.

첨부 화면과 요구 문서를 기준으로 현재 사이트의 녹색·종이색 UI에 맞게 통합했다. 원래 사이트는 이 작업에서 접근을 확인하지 못했으므로 내부 구현이나 기존 DB를 복제한 것은 아니다. 원래 사이트의 과거 질문은 자동 이전하지 않는다.

## 주요 파일

| 역할 | 파일 |
| --- | --- |
| 학생 화면/미션 연결 | `src/components/student/StudentNewspaperPage.tsx`, `StudentMissionsPage.tsx`, `src/pages/AuctionPage.tsx` |
| 교사 화면/진입 | `src/components/teacher/TeacherNewspaperPanel.tsx`, `src/pages/TimerPage.tsx` |
| 공통 모달·스타일 | `src/components/NewspaperDialog.tsx`, `src/index.css` |
| 설정·검증·주차·TXT | `src/lib/newspaperQuestion.ts` |
| 클라이언트·mock·조회 | `src/lib/newspaperClient.ts`, `newspaperLocalStore.ts`, `useNewspaper.ts` |
| 서버/API | `api/newspaper.ts`, `src/server/newspaperRepository.ts` |
| 기존 미션/현황/보상 감사 연결 | `api/weekly-mission.ts`, `api/weekly-missions.ts`, `src/server/rewardAuditRepository.ts`, `src/lib/weeklyMission.ts`, `questionSubmissionStatus.ts`, `saveFailure.ts` |
| Netlify 배포 연결 | `vite.config.ts`, `netlify.toml`, `netlify/functions/api.mts` |
| DB | `supabase/newspaper_questions.sql` |
| 신규 테스트 | `src/lib/newspaperQuestion.test.ts`, `newspaperClient.test.ts`, `tests/api/newspaper.test.ts`, `newspaper.postgres.test.ts` |

기존 weekly-mission(s) API 테스트와 Node ESM 경계 테스트도 내부 데이터 원본에 맞춰 수정했다. 작업 시작 전 존재하던 우체통·디자인·보안 헤더 등의 변경은 보존했다.

## DB와 API

추가 테이블은 `newspaper_questions`, `newspaper_topics`, `newspaper_receipts`, `newspaper_audit`이다. 질문 unique key는 `(student_number, question_type, week_key)`, 주제 unique key는 `week_key`다. 학생 범위, 길이, 유형, 주차 형식 제약을 DB에도 적용한다.

`newspaper_read`는 학생에게 이번 주 질문과 자기 기록만 반환한다. 학생 응답의 `downloaded_at`은 숨긴다. `newspaper_command`는 기능 단위 트랜잭션 잠금, 수정 버전 검사, 요청 영수증, 기존 보상 RPC를 사용한다. 누적 다운로드는 `UPDATE ... RETURNING`으로 원자적으로 선정한다.

요청 영수증은 응답이 유실됐을 때 같은 요청 ID로 동일 결과를 확인하기 위한 것이다. 다른 저장을 해도 미확인 요청을 덮어쓰지 않는다. 교사에게 미확인 TXT 복구 버튼을 제공한다. 삭제된 질문이 들어 있는 영수증은 무효화하며, 전체 초기화는 영수증 본문도 비운다. 지급 내역은 유지한다.

프로젝트의 단일 action API 패턴에 맞춰 예시 API들을 하나로 합쳤다. Netlify adapter는 `/api/newspaper`를 같은 핸들러로 전달한다.

| 요청 | 용도 |
| --- | --- |
| `GET /api/newspaper?weekKey=YYYY-WW` | signed session에 따른 학생/교사 조회 |
| `POST /api/newspaper` | `{ requestId, command }` 처리 |
| `command.action=submit` | 학생 본인 개인/주제 upsert |
| `topic`, `update`, `delete` | 교사 주제/질문 관리 |
| `download` | 주차·개인/주제/전체·누적 여부로 TXT 대상 조회/선정 |
| `reset` | 교사 확인 문구 검증 후 전체 질문·주제 초기화 |

기존 `/api/weekly-mission`, `/api/weekly-missions`의 호출 계약은 유지하고 질문 근거만 내부 DB로 변경했다.

## 인증·개인정보·오류 처리

- 번호 입력 자체를 권한으로 사용하지 않고 기존 서명 기기 세션으로 학생/교사를 결정한다.
- 서버에서 학생 번호 소유권, 주차, UUID, 유형, 길이, 수정 버전을 검사한다.
- 변경 요청에 기존 cross-site 검사와 rate limit을 적용한다. 본문은 8KiB로 제한한다.
- 테이블/RPC는 anon 및 authenticated 권한을 철회하고 서버의 service role 경로만 허용한다.
- SQL 매개변수 바인딩, React text escaping, no-store, 서버 allowlist 오류 코드를 사용한다.
- 최종 저장 확인 실패는 기존 `saveFailureClient`로 보고한다. 질문 원문·이름 목록·비밀키를 보고하지 않는다.
- 학생 이름 목록은 서버 `NEWSPAPER_PRIVATE_WORDS`, 금칙어는 `NEWSPAPER_BLOCKED_WORDS`에 쉼표로 구분해 설정할 수 있다. 이름 목록은 클라이언트에 배포하지 않으므로 해당 검사는 서버가 최종 판정한다. 미설정 시 목록은 비어 있다.
- 일반 표시·길이·TXT 헤더는 `NEWSPAPER_CONFIG`에서 관리한다. 23명/0번 교사/한국 월요일 주차는 기존 학급·보상 DB 계약이므로 바꾸려면 SQL 제약과 기존 도메인도 함께 검토해야 한다.
- mock는 외부 통신 없이 localStorage를 사용하고 readonly는 변경을 거절한다. 운영 API가 없거나 응답이 불명확하면 저장 성공으로 표시하지 않는다.

## 검증 결과 (2026-09-13)

- `npm run lint`(TypeScript 검사), `npm run build`, `git diff --check` 통과.
- 전체 테스트 1,245개 중 1,244개 통과, 기존 날짜 의존 테스트 1개 실패, skip 0.
- 실패: `src/lib/studentMissionPresentation.test.ts`의 “1인 1역 카드는 배정된 역할 또는 오늘 역할 없음을 표시한다”. 현재 일요일에는 기존 도메인이 역할 없음으로 처리하지만 테스트는 칠판 전문가를 기대한다. HEAD의 같은 도메인·테스트에도 이 조건이 존재하며 해당 로직은 변경하지 않았다.
- 신문 기능 및 서버 함수 경계 대상 테스트 13개 통과.
- 별도 임시 경로에 설치한 PGlite에서 실제 저장·보상 SQL 실행, 반복 적용, upsert, 보상 중복 방지, 충돌, 누적/전체, 삭제·초기화·권한 테스트 통과. 앱 의존성은 추가하지 않았다.
- PGlite는 단일 엔진이므로 `Promise.all` 요청 결과가 겹치지 않는 것은 확인했지만, 서로 다른 운영 PostgreSQL 연결 간 잠금 경쟁까지 실측한 것은 아니다.
- 로컬 HTTP 서버와 curl에서 비인증 GET 401, PATCH 405 및 Allow 헤더 확인. 외부 서버에는 요청하지 않았다.

DB 테스트를 재실행할 때는 임시로 설치한 PGlite의 `dist/index.js` 절대 경로를 `NEWSPAPER_PGLITE_MODULE`에 지정한다. 미지정 시 PostgreSQL 테스트 하나는 명시적으로 skip한다.

```sh
node --import tsx --test src/lib/newspaper*.test.ts tests/api/newspaper*.test.ts src/lib/vercelFunctionImports.test.ts
```

## 실제 브라우저 검증

`http://localhost:3001/`의 연습 모드에서만 가상의 질문으로 확인했다. 실제 학생 잔액·기록은 변경하지 않았다.

- 학생 미션에서 외부 페이지 없이 신문 질문 진입, 주제 없는 상태, 공백 검증, 안경 적용, 개인 질문 Enter 제출.
- 교사 주제 저장, 개인 질문 수정 후 누적 대기 복귀, 수정본 누적 TXT 다운로드, 버튼 수량·disabled 반영.
- 주제 질문 저장, 개인 미제출 학생의 “개인 질문 먼저!” 차단, 새로고침 후 번호와 미제출 초안 유지.
- 교사 주제 필터에서도 23명 행 유지. 초기화 확인 문구 미입력 상태에서 실행 버튼 비활성화, Escape 취소, 원래 버튼으로 포커스 복귀. 브라우저에서 실제 전체 삭제는 실행하지 않았다.
- 학생 기록 모달의 자기 기록 표시, Tab 포커스 유지, Escape 및 포커스 복귀, 하나의 active aria-modal.
- 학생과 교사 화면에서 1280×650, 1280×600, 1280×800, 768×700, 320×600 확인. 문서 가로/세로 넘침 없음, 긴 내용은 패널 내부 스크롤. 320px에서 가려지던 학생 제목·번호를 수정 후 재검증했다. 제출 버튼 높이 44px.
- 최종 확인 시 브라우저 콘솔 오류·경고 없음.

실제 OS 한글 IME의 조합 과정, 브라우저 텍스트 확대, 운영 서버/학교 Chromebook 접속은 아직 현장 검증하지 않았다. IME는 plain input과 composition/229 Enter 가드로 보호한다.

## 운영 반영 순서와 미완료 항목

2026-09-13 사용자 승인 후 운영 `School_Timer` Supabase에 `integrate_newspaper_questions` 마이그레이션을 적용했다. 신규 질문 조회는 0건으로 정상 확인했다. 기존 학생 기록·고마·과거 질문 사이트는 변경하지 않았다. 과거 질문 이전은 사용자 요청으로 진행하지 않는다. 앱/API 운영 배포는 아직 미완료다.

Netlify adapter에도 `/api/newspaper`를 연결하고 옛 질문 사이트 redirect와 제외 경로를 제거했다.

1. 운영 DB의 기존 `storage_v2.sql` 및 `storage_rewards_v2.sql` 적용 상태, wallet/weekly reward 테이블, service-role 설정을 읽기 전용으로 확인한다.
2. 승인 후 `supabase/newspaper_questions.sql`을 먼저 적용한다. 기존 테이블을 삭제하는 마이그레이션이 아니라 신규 테이블/RPC를 추가한다. 파일 적용 자체는 질문 초기화 명령을 실행하지 않는다.
3. 필요한 금칙어·개인정보 목록은 안전한 서버 환경변수 관리 화면에서 설정한다. 원문을 채팅·로그·Git에 남기지 않는다.
4. 승인된 방식으로 앱/API를 배포한다. 배포 전에는 새 DB가 필요하므로 UI만 먼저 배포하지 않는다.
5. 별도 QA 환경에서 학생/교사 세션, 네트워크 응답 유실, 서로 다른 DB 연결의 동시 누적 요청, 실제 IME 및 Chromebook을 확인한다. 운영 검증에 실제 학생 보상을 테스트 데이터로 사용하지 않는다.

문제 발생 시 새 테이블을 DROP하거나 보상을 되돌리지 않는다. 질문 자료는 보존하고 앱/API의 이전 배포 전환 여부를 별도로 판단한다. 이전 앱으로 돌리면 차단된 외부 신문 사이트 연결도 돌아오므로 완전한 기능 복구 수단은 아니다.
