# Student overview mirrored destinations — clone fidelity review

## Recommendation: APPROVE

## Scope and success criteria

Read-only review of the requested **true layout rearrangement** at the supplied `1280 × 800` student overview capture. The required reading order is:

`[left action | left title/icon toward centered balance] [center balance] [right icon/title toward centered balance | right action]`.

Checked center symmetry, visual hierarchy, icon/title ordering, Korean copy clipping, action legibility, and whether the change is an actual DOM/CSS layout change rather than an arrow-only or image-based substitution.

## Evidence inspected

- Fresh capture: `.omo/evidence/student-overview-mirrored-destinations.jpg` — JPEG, `1280 × 800`, modified `2026-08-13T20:00:40+0900`, SHA-256 `ef58c80e7f0715e2b83d78ddf60e5fd9974ceb5725ecc8f0c8217bfc3cba01ad`.
- Current implementation: `src/components/student/StudentSectionCard.tsx:1-35`.
- Parent composition: `src/components/student/StudentOverviewPage.tsx:127-148`.
- Active Chromebook layout: `src/index.css:16532-16547`, `src/index.css:16662-16707`.
- Base card/action rules: `src/index.css:14557-14625`.
- Design-token contract and directional requirement: `DESIGN.md:82-102`, `DESIGN.md:162-170`.
- Scoped diff and whitespace check: `git diff -- src/components/student/StudentSectionCard.tsx src/components/student/StudentOverviewPage.tsx src/index.css DESIGN.md`; `git diff --check` (clean).
- Notepad inspected: `.omo/evidence/task-1-apple-ui-refresh-plan/notepad.md`; it is a July baseline note unrelated to this layout and was not treated as success evidence.

The capture is newer than the reviewed CSS and `StudentSectionCard.tsx` (both `19:59:33+0900`), so it is fresh for this change. No separate reference image was supplied; the stated mirrored-order contract is the comparison target.

## Findings

### CRITICAL

None. The destination row is live React DOM: `StudentOverviewPage` renders two reusable `StudentSectionCard` instances with `StudentBalanceSummary` between them (`src/components/student/StudentOverviewPage.tsx:127-148`). The reviewed image is not referenced by source, and no card is replaced by a raster or `background-image`.

### HIGH

None. This is a real structural rearrangement, not an arrow-only alteration:

- The left mission card receives `direction="left"` (`src/components/student/StudentOverviewPage.tsx:128-135`).
- Its active layout switches its grid from `"heading action"` to `"action heading"` (`src/index.css:16668-16680`).
- Its heading also uses `flex-direction: row-reverse`, placing the title then icon at the balance-facing edge (`src/index.css:16690-16692`).
- The unchanged right/default direction keeps `heading` then `action`, while `StudentPurchaseCard` reuses the same primitive (`src/components/student/StudentPurchaseCard.tsx:12-18`).

### MEDIUM

None. At `1280 × 800`, the capture shows equal-height left/right destination cards and an information-only balance card centered between them. The left button sits at the outer left with a left arrow; `고마 벌기` and its icon sit on the center-facing side. The right card mirrors this: bag icon then `고마 쓰기` toward the balance and the right-arrow button at the outer right. The three-column rule is token-driven: flexible side columns flank `--student-overview-balance-width` (`src/index.css:16662-16665`; `src/index.css:15373-15374`; `DESIGN.md:82-83`).

### LOW

None. The Korean labels `미션 시작`, `고마 벌기`, `사용 가능 고마`, `예약 고마`, `고마 쓰기`, and `경매장·기부 보기` are fully visible in the supplied capture. No orphaned CJK glyph, clipped baseline, truncated action label, or icon/label collision is visible. The actions remain high-contrast filled controls, distinct from the quieter balance status.

## Positive verification

- The balance is the geometric and semantic center without competing with the two navigational actions.
- Icon/title order mirrors correctly: left reads action → title → icon → balance; right reads balance → icon → title → action.
- Styling uses the documented card/spacing/control tokens, and both destinations share one component primitive rather than duplicated card markup.
- The only intended scene image is the separate home-canvas illustration; it is not used in place of the live destination or balance UI.

## Blockers

None.

## Limitation

This PASS is bounded to the supplied fresh `1280 × 800` capture and reviewed source. No independently captured 1024px, 1366px, zoomed, hover, or focus state was supplied for this narrowly scoped request; those states are not approved by this artifact.
