# 학급 기부 기능 코드 리뷰

- 검토일: 2026-07-14
- 저장소: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer`
- 목표: 현재 작업트리의 학급 기부 변경을 읽기 전용으로 검토하고, SQL 원자성·중복 요청·예약 고마, TimerPage 자동저장 충돌, AuctionPage 비공개 정보·모달 UX를 확인한다.
- 범위: `DESIGN.md`, `src/components/AuctionRoom.tsx`, `src/lib/currency.ts`, `src/lib/supabaseSettings.ts`, `src/lib/weeklyMission.ts`, `src/pages/AuctionPage.tsx`, `src/pages/TimerPage.tsx`, `supabase/app_settings.sql`, untracked `src/lib/classDonation.ts`, `src/lib/classDonation.test.ts`, `src/lib/classDonationSql.test.ts`, `public/donation-squirrel.png`
- ulw 상태: `omo ulw-loop status --json` 실행 불가(`omo: command not found`). 활성 ulw 경로를 확인할 수 없어 fallback 경로를 사용했다.
- 기존 기부 evidence/notepad: `.omo`에서 기부 관련 아티팩트나 notepad를 찾지 못했다.

## 결론

- `codeQualityStatus`: **BLOCK**
- `recommendation`: **REQUEST_CHANGES**
- CRITICAL: 0
- HIGH: 5
- MEDIUM: 2
- LOW: 1

## CRITICAL

없음.

## HIGH

### H1. 교사 자동저장이 기부 차감 잔액과 통화 이력을 되돌린다

- 위치:
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:4249`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:4257`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/weeklyMission.ts:221`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/weeklyMission.ts:268`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/weeklyMission.ts:279`
- `TimerPage`는 stale snapshot을 `mergeConcurrentCurrencyUpdatesIntoSettings`로 저장한다. 이 병합은 원격 `weekly_mission`과 `auction_award` 이력만 잔액에 반영하고, 새 `class_donation` 차감은 합치지 않는다. 반면 `classDonation.totalAmount/history`만 원격 값으로 보존한다.
- 비변경 순수 함수 재현 결과는 `balance=100`, `history=[]`, `donation.totalAmount=10`이었다. 원격 기부가 100→90으로 차감된 뒤 교사 자동저장이 실행되면 잔액은 100으로 환원되고 기부 총액은 10으로 남아 정합성이 깨진다.
- 영향: 학생이 차감된 고마를 다시 사용하면서 기부 총액은 유지되어 통화가 중복 생성된다.

### H2. 학생에게 비공개인 물품명과 기부 이력이 네트워크 응답으로 전달된다

- 위치:
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:9`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/supabaseSettings.ts:39`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/supabaseSettings.ts:42`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:294`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:314`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classDonation.ts:13`
- 학생 화면은 `app_settings.value` 전체를 조회한 뒤 브라우저 안에서 `getClassDonationPublicState`로 `itemName`과 `history`를 제거한다. RLS도 해당 공유 행 전체 읽기를 허용한다.
- 영향: DOM에는 숨겨져도 학생은 DevTools 네트워크 응답이나 직접 Supabase 조회로 비공개 물품명, 다른 학생 번호·기부액·시각을 볼 수 있다. 클라이언트 후처리는 접근 제어가 아니다.

### H3. 중복 요청 방지가 네트워크 불확실성 및 장기 재시도에 안전하지 않다

- 위치:
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:685`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:689`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:700`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:327`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:333`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:380`
- 같은 `p_request_id`가 최근 history에 남아 있는 동안의 즉시 중복은 막는다. 그러나 UI는 매 확인 시 새 UUID를 만들고 오류 시 그 키를 폐기한다. 서버 커밋 후 응답만 유실된 경우 사용자의 재시도는 새 키로 두 번째 차감을 만든다.
- 서버의 멱등성 기록도 최근 500개 history로 잘리므로 오래된 동일 키는 다시 처리된다. 키가 원래 `studentNumber`/`amount`와 일치하는지도 검증하지 않는다.
- 영향: 되돌릴 수 없는 고마가 중복 차감될 수 있다.

### H4. 목표액 편집이 기존 기부 총액을 조용히 삭제한다

- 위치:
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:8117`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:8122`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classDonation.ts:43`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classDonation.ts:45`
- 목표 입력을 비우는 중간 상태도 즉시 `1`로 바꾸고 `totalAmount`를 `Math.min(previous.totalAmount, targetAmount)`로 축소한다. 이후 목표를 다시 늘려도 잘린 총액은 복구되지 않지만 history와 학생 잔액 차감은 그대로다.
- 영향: 단순 목표액 수정으로 학급 기부 진행액이 사라지고 history 합계, 표시 총액, 실제 차감액이 서로 달라진다.

### H5. 익명 RPC가 요청 학생 번호를 신뢰해 다른 학생의 잔액도 차감할 수 있다

- 위치:
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:269`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:292`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:423`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/RootApp.tsx:33`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/RootApp.tsx:49`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/RootApp.tsx:144`
- `donate_to_class_goal`은 `anon`에 공개되고 `p_student_number`가 1..23인지밖에 확인하지 않는다. 학생 번호는 인증된 주체가 아니라 사용자가 고르고 localStorage에 저장한 값이다.
- 영향: 브라우저 콘솔이나 직접 RPC 호출로 다른 학생 번호를 지정해 그 학생의 고마를 기부 처리할 수 있다. 기존 공유 설정의 신뢰 기반 구조를 감안해도, 새 `security definer` 차감 API 자체에는 소유자 검증이 없다.

## MEDIUM

### M1. SQL 테스트가 실행 의미가 아닌 구현 문자열만 확인한다

- 위치:
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classDonationSql.test.ts:5`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classDonationSql.test.ts:9`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classDonation.test.ts:11`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classDonation.test.ts:24`
- `classDonationSql.test.ts`는 SQL 파일에 `for update`, 오류 문자열, grant 문자열이 있는지만 검사한다. 행 잠금이 있어도 멱등성·예약액·동시성 로직이 틀릴 수 있으므로 tautological/implementation-mirroring 테스트다.
- “student state never exposes” 테스트도 이미 브라우저에 도착한 원본 payload를 검사하지 않고 로컬 projection 결과만 확인한다. “teacher settings saves preserve” 테스트 역시 기부 총액/history만 보고 통화 잔액/history를 검사하지 않는다.
- 실제로 29개 테스트가 모두 통과했지만 H1 재현은 실패 상태를 만들었다. `remove-ai-slops`와 `programming` 관점 모두에서 false confidence를 주는 테스트다.

### M2. 변경이 이미 과대형인 UI 모듈에 기능 상태·I/O·모달 마크업을 더 집중시킨다

- 위치:
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:3404` (순수 LOC 10,048)
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:84` (순수 LOC 993)
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/AuctionRoom.tsx:37` (순수 LOC 354)
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/weeklyMission.ts:206` (순수 LOC 318)
- 기부 도메인 helper 추출은 적절하지만, 교사 설정·자동저장·학생 RPC·모달 상태가 기존 대형 컴포넌트에 직접 결합됐다. `TimerPage`에는 새 `as Record<string, unknown>` assertion도 추가됐다(`/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:8071`).
- `remove-ai-slops`/`programming`의 250 pure LOC, needless complexity, untyped escape-hatch 관점 위반이다. 이 항목 자체는 정확성 실패가 확인된 H1/H4보다 낮은 MEDIUM으로 분류한다.

## LOW

### L1. 기부 완료 후 상태 모달을 닫으면 포커스가 기부 트리거가 아니라 입찰 컨트롤로 이동한다

- 위치:
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:137`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:193`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:697`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/useModalFocus.ts:136`
- 기부 dialog를 닫는 동시에 status dialog를 열기 때문에 donation dialog의 return-focus는 top modal 검사에서 보류된다. status 종료 경로는 `focusAuctionReturnTarget`을 호출해 입찰 버튼/금액 입력을 우선한다.
- 영향: 키보드 사용자의 맥락이 기부 트리거로 돌아오지 않는다. focus trap, Escape 차단, 배경 inert 자체는 기존 `useModalFocus`를 사용한다.

## SQL 원자성·예약 고마 확인 결과

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:302`의 `SELECT ... FOR UPDATE`와 같은 트랜잭션의 `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:408` 업데이트는 기부 RPC끼리의 원자적 직렬화를 제공한다.
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/app_settings.sql:357`의 예약액 계산은 정상화된 현재 상태에서는 미낙찰 최고 입찰액 합계를 차감하는 클라이언트 규칙과 일치한다.
- 다만 실제 PostgreSQL/Supabase 실행 도구(`psql`, `supabase`, `docker`)가 환경에 없어 DB 동시성·오류 경로는 런타임 검증하지 못했다. 문자열 검사 테스트는 이 공백을 메우지 못한다.

## 검증 증거

- `git diff --check`: PASS
- `npm run lint` (`tsc --noEmit`): PASS
- `npm test`: PASS, 29/29
- 순수 함수 충돌 재현: FAIL 상태 확인. 출력: `{"balance":100,"history":[],"donation":{"totalAmount":10,...}}`
- 실제 학생 데이터 접근/변경: 수행하지 않음
- 브라우저 기부 제출 QA: 수행하지 않음. 격리된 기부용 Supabase fixture가 없고 실제 학생 데이터 변경 금지 조건을 우선했다.

## 스킬 관점 및 review-work 적용

- `omo:remove-ai-slops`: 실행. SQL 문자열 미러링 테스트, 과대형 모듈 확장, false-confidence 테스트를 위반으로 판단했다. `classDonation.ts`의 외부 payload 정규화 자체는 실제 저장소/RPC 경계에 필요하므로 불필요한 parsing slop으로 보지 않았다.
- `omo:programming`: 실행하고 TypeScript data-modeling/error-handling/code-smells 기준까지 확인했다. 구현 미러링 테스트, 새 type assertion, 과대형 파일 확장이 위반이다. 새 `any`, `@ts-ignore`, `@ts-expect-error`는 발견하지 못했다.
- `omo:review-work`: 스킬을 읽고 목표·QA·코드 품질·보안·git 맥락의 다섯 관점을 수동으로 수행했다. 현재 도구 목록에 subagent spawn/wait가 없어 지침의 5-agent 병렬 실행은 불가능했다.
- `omo:debugging`: 실제 DB를 실행할 수 없어 partial-runtime-evidence 관점을 적용했고, H1은 실제 production helper를 실행한 순수 함수 재현으로 확인했다. SQL 런타임 주장은 제한을 명시했다.

## Blockers

1. 자동저장 병합이 원격 `class_donation` 잔액 차감과 통화 이력을 정확히 한 번 보존하도록 수정하고 회귀 테스트를 추가해야 한다.
2. 학생은 비공개 `itemName/history`가 포함되지 않은 서버 측 projection/RPC만 조회하도록 데이터 경계를 분리해야 한다.
3. 멱등성 키를 서버의 내구성 있는 unique ledger에 보관하고 student/amount에 결합하며, 클라이언트가 불확실한 재시도에서 같은 키를 재사용해야 한다.
4. 목표액 편집이 `totalAmount`를 묵시적으로 줄이지 않도록 하고, 현재 총액보다 낮은 목표 변경은 명시적으로 처리해야 한다.
5. 익명 호출의 학생 번호를 신뢰하지 말고 인증된 주체 또는 서버 검증 가능한 세션과 결합해야 한다. 신뢰 기반 운영이 의도된 정책이라면 그 위험을 명시적으로 승인받아야 한다.

