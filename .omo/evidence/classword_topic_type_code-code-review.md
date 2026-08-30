# Code quality review — classword_topic_type_code

## Scope and evidence inspected

- Goal: make the teacher ClassWord today's topic use exactly the student screen's font/type scale, including the responsive rule.
- Reviewed CSS/token changes in `src/classword.css` and `src/index.css`, documentation in `DESIGN.md`, and `src/lib/classwordPresentation.test.ts`.
- Inspected `src/components/teacher/TeacherClasswordPanel.tsx` and `src/components/student/StudentClasswordPage.tsx` only to validate selector/DOM applicability.
- The supplied attempt metadata was unavailable: `omo ulw-loop status --json` could not run because `omo` is not installed on `PATH`; this report uses the required fallback path.

## Verification

- PASS: `src/main.tsx` imports `index.css` before `classword.css`, so the latter is evaluated later.
- PASS: the shared selector at `src/classword.css:14-21` applies the same display font, shared `--classword-topic-heading-size`, weight, tracking, and line-height to the student `h1` and teacher topic `h3`.
- PASS: the teacher DOM matches `.teacher-classword-today-topic h3` at `src/components/teacher/TeacherClasswordPanel.tsx:151-158`; the student DOM is the `StudentHeader` heading containing `.classword-header-topic` at `src/components/student/StudentClasswordPage.tsx:218-225`.
- PASS: at `max-width: 760px`, `src/classword.css:653-655` assigns the same `1.35rem` and `1.15` line-height to both targets. The target rule wins over earlier generic student-header rules by source order and/or specificity.
- PASS: `npm run lint`, `npm test`, and `node --import tsx --test src/lib/classwordPresentation.test.ts` completed successfully. `git diff --check` was clean.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. `src/lib/classwordPresentation.test.ts:286-304` is a brittle source-text/implementation-mirroring test, rather than a behavior test. It pins JSX class strings, exact CSS declaration order, and the literal token value `clamp(1.6rem, 2.8vw, 2.25rem)`. It would not catch a stylesheet import/cascade failure in a rendered view, while legitimate selector or token refactors would fail it. This violates the `programming` and `remove-ai-slops` perspectives on implementation-mirroring tests. It does not presently demonstrate an incorrect UI outcome, so it is not an approval blocker.

2. `src/lib/classwordPresentation.test.ts:286-304` bundles unrelated assertions (entry deletion controls, board profile size, panel copy, and grid structure) into the heading/type-scale test. The unrelated pins make a typography regression test harder to diagnose and create false coupling to separate UI work. This is scope/test-maintainability drift, not a demonstrated behavioral regression.

### LOW

1. The reviewed diff includes unrelated calendar, navigation, board-action, and documentation changes alongside the single typography goal. No defect in the target typography path was found, but separating those changes would make future review and rollback safer.

## Skill-perspective check

- Ran: yes. Loaded and applied `omo:programming` (including its TypeScript guidance) and `omo:remove-ai-slops`.
- `remove-ai-slops`: production CSS/token change is compact and contains no needless data extraction, parsing, normalization, abstraction, or deletion-only test. The changed test does violate its implementation-mirroring/weak-behavior-coverage guidance (MEDIUM finding 1).
- `programming`: no new untyped escape hatch or production validation/parsing issue was found. The changed test violates its rule against brittle implementation-mirroring tests (MEDIUM finding 1).

## Decision

- `codeQualityStatus`: WATCH
- `recommendation`: APPROVE
- `blockers`: None. The MEDIUM test-quality findings should be addressed in follow-up work, but the target CSS implementation itself correctly centralizes and applies the required student typography to the teacher topic at desktop and `<=760px` responsive layouts.
