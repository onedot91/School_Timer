# Remove Writing Reward Badge Gate Review

## recommendation

APPROVE (user-facing verdict: PASS)

## blockers

None.

## originalIntent

교사 설정의 `글쓰기 > 글밥 편지` compose-card 헤더 오른쪽에 있던 작은 `+25 고마` 배지만 제거한다. 25고마 지급 규칙과 하단 학생별 제출 확인·지급·지급 취소 기능은 그대로 유지한다.

## desiredOutcome

- `.teacher-writing-compose > header`에는 `글밥 편지` 제목만 남고 보상 badge/icon이 렌더링되지 않는다.
- 사용자의 1255×784 in-app browser 화면에서 배지 제거 뒤 헤더와 compose form 레이아웃이 자연스럽다.
- 하단 `제출 확인과 보상` 섹션, 23명 지급 상태, 학생별 `+25 고마` 지급 및 지급 취소 controls가 유지된다.
- 실제 reward amount, 중복 지급 방지, 지급 취소 로직은 변하지 않는다.

## userOutcomeReview

PASS. Fresh JPEG를 직접 열어 확인했으며 compose-card 헤더 오른쪽 배지는 사라지고 `글밥 편지` 제목, 날짜·주제·낱말 입력 폼, 발행 버튼 영역은 정렬 깨짐·겹침 없이 유지된다. 현재 DOM 소스의 compose header에는 `h3`만 있어 `strong` count 0이라는 제공 evidence와 일치한다. 하단 제출 섹션은 소스에 그대로 존재하며 23개 학생 button이 `onReward`/`onCancelReward`를 호출한다. `TimerPage.tsx`는 해당 callbacks를 실제 25고마 ledger 지급·취소 함수에 계속 연결한다.

## successCriteriaReview

| criterion | result | evidence |
|---|---|---|
| C1 compose-card 헤더의 compact `+25 고마` badge만 제거 | PASS | `TeacherWritingSettings.tsx:69-72`; fresh capture; compose header에 `h3`만 존재 |
| C2 badge icon/import 및 전용 style 잔존 없음 | PASS | `TeacherWritingSettings.tsx:1`은 `RotateCcw`, `Send`, `Utensils`만 import; `rg`에서 compose reward badge/`Coins`/compose-header-strong selector 없음 |
| C3 compose form/layout 유지 | PASS | fresh 1254×784 JPEG에서 제목·날짜·주제·낱말 fields와 발행 영역이 정상 정렬됨; `TeacherWritingSettings.tsx:74-119` |
| C4 하단 submission reward controls 유지 | PASS | `TeacherWritingSettings.tsx:124-155`; 23개 button, `+25 고마`, 지급 취소, callbacks 유지 |
| C5 25고마 reward behavior 유지 | PASS | `dailyWriting.ts:14`, `:216-250`, `:252+`; `TimerPage.tsx:8725-8845`, `:9311-9322`; 관련 tests PASS |
| C6 제공 validation 재현 | PASS | `npm test` 192/192, `npm run lint`, `npm run build`, `git diff --check` 모두 exit 0 |

## direct remove-ai-slops / programming review

- production code와 tests를 직접 검사했다. 요청된 UI 제거만 확인하는 deletion-only test, 자연어 문구 pin, snapshot, tautology, output-derived expected, 구현 미러링 test는 추가되지 않았다.
- 이번 변경은 header child와 그 전용 badge 표현을 제거하는 최소 범위 변경이다. reward constant, ledger parsing/normalization, persistence, callbacks에는 새 추출·파싱·정규화 또는 scope drift가 없다.
- 하단 `RotateCcw` icon은 지급 취소 control에 사용되므로 의도적으로 유지된다. compose header reward icon에 해당하는 import나 orphaned selector는 발견되지 않았다.
- 전체 uncommitted worktree에는 더 큰 daily-writing 기능 변경이 함께 존재하지만, 이 판정은 요청된 badge 제거 delta와 지정 artifact/surface에 한정했다.

## review-work coverage

- Goal/constraint: PASS, 요청된 header badge만 현재 compose header에서 제거됨.
- Hands-on visual QA: PASS, fresh JPEG 직접 검사.
- Code quality: PASS, dead import/style·불필요 abstraction·test overfit 없음.
- Security: PASS/N/A, 표시 요소 제거이며 auth/data boundary 변경 없음.
- Context: PASS, 이전 `teacher-writing-current.png`에서 badge 존재를 확인하고 fresh capture와 비교했으며 하단 reward code path를 추적함.
- `review-work`의 subagent 도구는 현재 세션에 노출되지 않아 다섯 lane을 독립 agent로 실행할 수 없었고, 위 lane을 final gate reviewer가 직접 수행했다.

## checkedArtifactPaths

- `.omo/evidence/remove-writing-reward-badge/teacher-writing-without-reward-badge.jpg`
- `.omo/evidence/daily-writing/teacher-writing-current.png` (이전 badge 존재 비교용)
- `src/components/teacher/TeacherWritingSettings.tsx`
- `src/pages/TimerPage.tsx`
- `src/lib/dailyWriting.ts`
- `src/lib/dailyWriting.test.ts`
- `src/index.css`
- `.omo/evidence/daily-writing-gate-review.md`
- `.omo/evidence/writing-assigned-calendar-gate-review.md`

## exactEvidenceGaps

- `omo ulw-loop status --json`은 `omo: command not found`로 실행되지 않아 ULW attempt directory를 확인할 수 없었다. 규정된 fallback report path를 사용했다.
- 이 narrow change 전용 executor notepad, code review report, manual QA matrix는 제공되거나 evidence directory에서 발견되지 않았다. 직접 artifact/source/slop/overfit 검토와 재실행한 gates가 모든 명시 criterion을 지지하므로 blocker가 아니다.
- JPEG 파일은 1254×784이며 사용자가 지정한 in-app browser viewport는 1255×784다. 1px capture 차이는 보이지만 이번 요청에서 명시한 실제 capture이며 레이아웃 결함은 관찰되지 않았다.
- fresh capture의 viewport에는 하단 submission grid가 화면 밖에 있어 이미지 하나로 controls를 시각 확인할 수 없다. 다만 현재 source와 callback wiring, 192개 전체 test 중 daily-writing reward/취소 tests로 기능 보존을 확인했다.

