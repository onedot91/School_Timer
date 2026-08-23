# Number Baseball Reward Visual Integrity — Final Gate Review

- recommendation: **APPROVE**
- blockers: `[]`
- reviewDate: 2026-08-23 (Asia/Seoul)
- reviewMode: read-only final gate; only this report artifact was added

## Original Intent

숫자야구 보상을 시도 횟수별로 정확히 `1–5회=20 고마`, `6–7회=10 고마`, `8–9회=5 고마`로 지급하고, 해당 보상 단계가 기록 화면과 성공 축하 시각 상태에 일관되게 반영되어야 한다.

## Desired Outcome

1. 계산·지급 경로가 위 세 보상만 허용한다.
2. 기록 UI가 동일한 단일 티어 정의를 사용해 각 시도 구간과 현재 획득 가능 보상을 표현한다.
3. 첫 티어의 `is-reward-20` 상태가 기존 최고 티어 레이아웃(3+2), 색상, 반응형 규칙, 축하 강조를 모두 받는다.
4. 정확한 1280×800 기본 뷰와 1024×800, 1366×800 보조 뷰에서 잘림·겹침 없이 사용할 수 있다.

## User Outcome Review

**충족.** `NUMBER_BASEBALL_REWARD_TIERS`가 세 구간을 정의하고 `getNumberBaseballReward`, 기록 컴포넌트, 미션 카드가 이 정의를 소비한다. 실제 지급 함수는 `[5, 10, 20]`만 허용한다. CSS의 최고 티어 선택자는 기록 색상, 3+2 그리드, 소형 화면 규칙, celebration halo/particle 모두 `is-reward-20`으로 일치한다. 세 캡처에서 첫 슬롯은 `+20 고마`로 표시되고 1–5, 6–7, 8–9 그룹의 시각 구획이 유지되며 텍스트 잘림이나 겹침이 없다.

## Success Criteria Checked

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| C1 | 1–5회는 20, 6–7회는 10, 8–9회는 5 | PASS | `src/lib/numberBaseball.ts:2-6`, `src/lib/numberBaseball.test.ts:86-94`; 직접 실행 `npm test` 136/136 |
| C2 | 실제 지급 경로가 20/10/5를 수용하고 그 외 값은 거부 | PASS | `src/lib/currency.ts:491-506`; 지급·중복방지·병합 테스트 `src/lib/numberBaseball.test.ts:186-223` |
| C3 | 첫 티어 관련 시각 선택자가 모두 reward-20과 연결 | PASS | `src/index.css:16418-16425`, `16482-16483`, `16512-16517`; `rg` 결과 `is-reward-15` 잔존 없음 |
| C4 | UI가 티어 정의를 직접 소비하며 접근성 이름도 동일 값 반영 | PASS | `src/components/student/StudentNumberBaseballHistory.tsx:18-48`, `src/components/student/StudentMissionsPage.tsx:139-145` |
| C5 | 1280×800 기본 및 1024/1366 보조 화면 무겹침·무잘림 | PASS | 아래 3개 JPEG 직접 원본 해상도로 시각 검사 |
| C6 | 변경 revision이 타입 검사·테스트·빌드를 통과 | PASS | 직접 재실행: `npm test` 136/136, `npm run lint` exit 0, `npm run build` exit 0 |

## Checked Artifact Paths

- `src/lib/numberBaseball.ts`
- `src/lib/currency.ts`
- `src/lib/numberBaseball.test.ts`
- `src/index.css`
- `src/components/student/StudentNumberBaseballHistory.tsx`
- `src/components/student/StudentNumberBaseballPage.tsx`
- `src/components/student/StudentMissionsPage.tsx`
- `tmp/number-baseball-reward-1280x800.jpg` — JPEG, 1280×800
- `tmp/number-baseball-reward-1024x800.jpg` — JPEG, 1024×800
- `tmp/number-baseball-reward-1366x800.jpg` — JPEG, 1366×800
- `.omo/ulw-loop/bootstrap-notepad.md` and `.omo/ulw-loop/notepad.md` — unrelated historical goals; no current goal notepad found

## Direct Remove-AI-Slops / Programming Pass

- Production change is minimal: one tier literal, one allowlist literal, and selector renames. No new abstraction, parser, normalization, dependency, dead branch, debug output, type escape hatch, or scope drift.
- Tests assert observable boundary mappings and persisted currency outcomes. They are not deletion-only, tautological, implementation-mirroring, prose/snapshot pins, or excessive duplicate tests.
- The reward boundary test covers 0/1/5/6/7/8/9/10, so all tier edges and out-of-range behavior are distinguished.
- The existing once-only and concurrent-save tests use 20 and verify resulting balance 120, providing behavior coverage beyond merely checking the constant.
- `src/index.css` is pre-existing oversized global CSS, but this revision adds no module/extraction burden and only corrects four selector groups. This is a NOTE, not a blocker tied to the stated criteria.

## Report-Coverage Check

No current executor report, code-review report, manual-QA matrix, or task-specific notepad path was supplied/found. Per gate policy, these absences do not block because the stated criteria are directly reproduced from source, captures, and locally rerun gates. Consequently, code-review-report confirmation of the skill perspectives is an evidence gap, not a failed product criterion.

## Exact Evidence Gaps / Notes

- NOTE [evidence]: no task-specific code-review report demonstrating its own `programming` and `remove-ai-slops` coverage.
- NOTE [evidence]: no standalone manual-QA matrix or console log artifact supplied; the three requested visual captures were present and inspected, but the claimed empty console was not independently reproduced through browser automation in this review.
- NOTE [evidence]: the static initial-state captures visibly show `+20 고마`; 10/5 values are structurally and accessibly generated from the same tier constant but are not printed in unopened future slots. Source inspection verifies their region labels and later current-slot values.
- NOTE [product]: build emits the existing Vite chunk-size warning; it is unrelated to reward correctness and violates no stated criterion.

## Blockers

None.
