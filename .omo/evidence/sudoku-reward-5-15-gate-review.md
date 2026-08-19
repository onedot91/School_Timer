# Sudoku reward 5/15 gate review

- recommendation: APPROVE
- originalIntent: 기본 스도쿠 완료 보상을 5 고마로 낮추고 도전 보상은 15 고마로 유지한다.
- desiredOutcome: 미션/난이도 선택/플레이 화면이 기본 +5, 도전 +15를 표시하며 실제 완료 원장은 기본 5, 도전 15를 문제별 한 번만 지급한다.
- userOutcomeReview: 충족. 공통 상수의 basic=5/challenge=15가 모든 UI 소비자와 실제 완료 지급 경로에 연결되며, 통화 원장 허용값도 5/15로 일치한다. 기본 지급 테스트는 100→105와 동일 puzzleId 재시도 미지급을 검증하고, 도전 동시 저장 테스트는 100→115와 원장 보존을 검증한다.
- blockers: []

## Checked artifact paths

- `src/lib/sudoku.ts`
- `src/lib/currency.ts`
- `src/lib/useStudentSudokuState.ts`
- `src/lib/sudoku.test.ts`
- `src/components/student/StudentMissionsPage.tsx`
- `src/components/student/StudentSudokuPage.tsx`
- `DESIGN.md`
- `.omo/evidence/sudoku-reward-5-15/current/basic-reward-receipt.json`
- `.omo/evidence/sudoku-reward-5-15/current/basic-5-reward-1280.jpg`
- `.omo/evidence/sudoku-reward-5-15/current/missions-{1024,1280,1366}.jpg`
- `.omo/evidence/sudoku-reward-5-15/current/modal-{1024,1280,1366}.jpg`
- `.omo/evidence/sudoku-reward-5-15/current/modal-effective-512.jpg`

## Reproduced evidence

- `node --test --import tsx src/lib/sudoku.test.ts`: 16/16 pass.
- `npm test`: 115/115 pass.
- `npm run lint`: pass (`tsc --noEmit`).
- `npm run build`: pass; existing Vite chunk-size warning only.
- `git diff --check`: pass.
- Receipt: `gridCellCount=36`, `gridLabel=기본 6×6 스도쿠 문제`, header contains `기본+5 고마자동 저장`.
- All eight JPEGs are valid and newer than changed source timestamps. Direct visual inspection confirms mission +5/+15, modal basic +5/challenge +15 at 1024/1280/1366 and effective 512, and play header basic +5.

## Direct programming / remove-ai-slops pass

- Minimal root-seam change: one shared reward constant plus the currency boundary allowlist; no duplicated per-UI literals or new abstraction.
- No dead code, needless parsing/normalization, type suppression, debug output, or scope drift introduced.
- Regression tests assert observable balances and idempotent ledger behavior. They are not deletion-only, tautological, prose-pinning, or implementation-mirroring tests.
- Challenge behavior is independently exercised by the concurrent-save test, which proves 100→115 and reward preservation.

## Evidence gaps / notes

- No goal-specific code-review report, manual-QA markdown matrix, or notepad was present. This is not a blocker because no stated success criterion requires those files and the direct source, test, receipt, and visual pass supports completion.
- The receipt proves the selected basic board/header but does not itself serialize the post-completion ledger. Actual payout and idempotency are instead reproduced by the production currency helper tests and traced through `useStudentSudokuState`.
