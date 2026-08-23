# Failure feed integrity release gate

- recommendation: REJECT (user-facing shorthand: REVISE)
- originalIntent: Replace the former curated-writing display with one anonymous, continuous failure-story exhibition that supports author edit/delete, classmate-only three-state cheer stamps, an accessible two-question composer, responsive Chromebook layouts, and no public identity/count/ranking/comment surface.
- desiredOutcome: At 1024/1280/1366×800 DPR1 the centered bounded feed remains readable and unobstructed; at 200% text zoom the gallery scrolls internally without horizontal overflow or FAB collision; the three-option stamp menu remains anchored and separated from adjacent rows; the composer uses the two exact requested questions and modal/focus/reduced-motion behavior.

## User outcome review

The current feed, stamp menu, and responsive evidence satisfy the visual outcome. The implementation also enforces anonymous rendering, owner-only edit/delete, classmate-only single stamp toggle/clear, three stamp choices, focus-managed composer dismissal, and reduced-motion fallbacks. One explicit copy contract is not satisfied: the second composer question is not the wording specified in `DESIGN.md`.

## Blockers

1. violatedCriterion: FAILURE-COMPOSER-QUESTION-2-EXACT
   - observation: The required second prompt is `한 번 더 해 본다면, 무엇을 다르게 해 보고 싶나요?`, but both create and edit forms render `다음에는 어떻게 해 보고 싶나요?`.
   - evidencePointer: `DESIGN.md:213`; `src/components/student/StudentFailureExhibitionPage.tsx:204`; `src/components/student/StudentFailureMessage.tsx:68`.

## Notes (non-blocking)

- Direct remove-ai-slops/programming pass found no criterion-blocking overfit, deletion-only, tautological, or implementation-mirroring test. The four domain tests assert observable persistence/authorization/toggle behavior. No unnecessary new dependency or public count/identity surface was found.
- The TSX files use existing project conventions. Skill-level preferences such as named exports and module-size limits are not stated product criteria and therefore are not blockers.
- The existing Vite chunk-size warning is unchanged and is not tied to this feature's success criteria.

## Checked artifacts

- `src/components/student/StudentFailureExhibitionPage.tsx`
- `src/components/student/StudentFailureMessage.tsx`
- `src/index.css`
- `DESIGN.md`
- `src/lib/failureExhibition.ts`
- `src/lib/failureExhibition.test.ts`
- `tmp/failure-feed-1024x800.png`
- `tmp/failure-feed-1280x800.png`
- `tmp/failure-feed-1366x800.png`
- `tmp/failure-feed-1280x800-text-200.png`
- `tmp/failure-feed-stamps-final.jpg`

## Reproduced evidence

- `npm run lint`: PASS (`tsc --noEmit`)
- `npm test`: PASS (143/143)
- `npm run build`: PASS; existing >500 kB chunk warning only
- Visual evidence: 1024/1280/1366 show one centered continuous three-row feed without visible overflow; 200% text view shows internal vertical scrolling, no horizontal overflow, and a visible gap between feed and FAB; stamp view shows all three options with no adjacent-row overlap.

## Exact evidence gaps

- No current artifact demonstrates the required exact second-question wording because the production components render different copy.
- No separate code-review report or manual-QA matrix for this feature was found under `.omo/evidence`; direct artifact inspection and reproduced commands support every other reviewed criterion.
