# Final gate review: weekly economy concurrency

- recommendation: **REJECT**
- originalIntent: 10번 학생의 집 구매와 고마 차감 불일치 재발을 막고, 구매/초기화/주간 정산/프로필/송금의 동시 저장을 일관되게 보존한다.
- desiredOutcome: stale teacher save와 학생 경제 API 저장이 경합해도 관련 잔액, 원장, 경제 상태, 프로필 배정 및 송금 편지가 모두 한 번씩 보존된다.
- userOutcomeReview: 구매 차감, 초기화 이후 차감 미복원, 최신 상태 기반 주간 정산, 송금 양측 원장 ID 연결은 격리 테스트에서 확인됐다. 그러나 프로필/송금이 포함된 `studentLife`는 필드/학생 단위 병합이 아니라 객체 전체 remote 우선 선택이라, 동시 교사 변경을 유실한다. 따라서 사용자가 기대한 동시 저장 결과는 충족되지 않는다.

## Blockers

1. violatedCriterion: `SC-CONCURRENT-PROFILE-TRANSFER`
   - observation: 한 학생의 새 `processedRequestIds`만 발견돼도 `remote.studentLife` 전체를 선택하므로 stale teacher snapshot의 다른 학생 프로필 배정과 편지가 손실된다.
   - evidencePointer: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/weeklyMission.ts:540`; 격리 재현 출력은 `{"failureProfileAssignments":{"4":"/profiles/4.png"},"letters":[{"id":"transfer-mail"}]}`로, next의 학생 5 배정과 `teacher-mail`이 모두 사라졌다.

## Checked artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/weeklyMission.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/currency.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/student-economy.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/weeklyMission.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tests/api/student-economy.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tests/api/shared-settings.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/weekly-economy-concurrency-manual-qa.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/driver.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/tax-reset-race.ts`

## Verification

- `node --import tsx --test src/lib/weeklyMission.test.ts src/lib/studentEconomy.test.ts tests/api/shared-settings.test.ts tests/api/student-economy.test.ts`: 83/83 pass.
- `npm run lint`: pass (`tsc --noEmit`).
- isolated in-memory adversarial reproduction: fail as described above; no Supabase/localStorage/real user data access or mutation.

## Skill-perspective review

- `omo:remove-ai-slops`: added tests exercise observable currency/economy outcomes and are not deletion-only, tautological, prose-pinning, or implementation-mirroring. `createWeeklyCurrencyCycle` is used by production and tests and is not a test-only extraction. The uncovered cross-field overwrite means the test matrix is incomplete for the stated concurrent profile/transfer criterion.
- `omo:programming`: the broad `studentLife` replacement couples unrelated students and subdomains and creates false confidence despite green tests. Other style/size concerns are notes only because they are not tied to the stated success criteria.

## Evidence gaps

- No dedicated code-review report for this attempt was found under `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/`; therefore no separate report demonstrates the required slop/programming perspective coverage. This is not the blocker; the direct review above supplies that coverage.
- The existing profile regression only checks remote profile preservation against an otherwise empty next `studentLife`; it does not cover simultaneous independent next-side profile/letter changes.
