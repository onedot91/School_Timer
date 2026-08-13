# Student overview bottom balance — gate review

- recommendation: REJECT (user-facing verdict: REVISE)
- originalIntent: Remove the overview top header, reclaim that space for the home canvas, and place the balance summary at the bottom center without breaking student interactions.
- desiredOutcome: A legible bottom-centered balance dock, expanded canvas, working hotspots/drag controls, no overflow at 1024/1280/1366 CSS px, and accessible behavior including keyboard use and 200% text zoom.

## User outcome review

The fresh 1280×720 capture visibly satisfies the primary layout request: there is no top header, the 16:9 stage occupies the reclaimed space, and the balance dock is centered at the bottom with clearly separated student number, available balance, and reserved balance. The dock is pointer-transparent, while mailbox/library/egg/emotion controls and draggable character controls remain real buttons with keyboard labels and handlers in source.

Approval is withheld because the requested responsive and accessibility verification is incomplete. Only one 1280×720 capture exists. There is no rendered evidence for the project-required 1024, 1280×800, or 1366 widths, nor for 200% text zoom. This matters because the bottom-dock rules are scoped to `@media (min-width: 64rem) and (max-height: 53.125rem)`; at a 200%-zoom effective CSS width near 640px those rules do not apply, so source inspection alone cannot prove the requested bottom dock and overflow safety survive zoom.

## Blockers

1. violatedCriterion: responsive-safety-and-accessibility
   - observation: No fresh rendered evidence verifies 1024, authoritative 1280×800, 1366, or 200% text zoom; the dock layout is breakpoint-dependent.
   - evidencePointer: `src/index.css:16518`, `src/index.css:16612`, `DESIGN.md` responsive behavior section, `.omo/evidence/student-overview-bottom-balance-current.jpg` (1280×720 only)

2. violatedCriterion: no-broken-hotspot-or-drag-interaction
   - observation: Source paths are intact, but no read-only live interaction evidence demonstrates pointer hit-testing, drag capture, or keyboard movement with the overlaid dock present.
   - evidencePointer: `src/components/student/StudentPetStage.tsx:130`, `src/components/student/StudentPetStage.tsx:151`, `src/components/student/StudentPetStage.tsx:192`, `src/index.css:16619`

## Direct slop / overfit pass

- No tests were added solely to assert removal or implementation details in the reviewed diff.
- No unnecessary extraction, parsing, normalization, dependency, or mock-only UI was introduced for this layout change.
- The implementation uses existing `StudentBalanceSummary`, stage buttons, and design tokens. No slop blocker found.

## Checked artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-bottom-balance-current.jpg` — valid JPEG, 1280×720, newer than reviewed source
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBalanceSummary.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `npm run lint` — passed (`tsc --noEmit`)

## Exact evidence gaps

- Fresh screenshots at 1024×800, 1280×800, and 1366×800.
- Fresh 200% text-zoom capture proving no horizontal overflow and a usable balance layout.
- Non-mutating interaction trace for mailbox/library/emotion/egg hotspots and pointer/keyboard drag behavior using isolated state.
- No executor code-review report, manual QA matrix, or notepad path was supplied; the direct review above covers source/slop criteria but cannot replace the missing rendered interaction evidence.
