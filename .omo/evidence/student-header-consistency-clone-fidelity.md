# Student header consistency — clone-fidelity review

**Verdict:** PASS  
**Recommendation:** APPROVE  
**Review mode:** Read-only visual/system review  
**Reviewed revision:** `0f55ea3f506c28477499c420fbf3751455486176` plus the current uncommitted worktree

## Contract reviewed

The target is consistency, not either prior attachment. At the Chromebook compact layout the overview balance header and store task header must share: 72px outer height, 20px radius, a 1px semantic border, and the same material. Both balance displays must use the same two-line label/value hierarchy. The nested store balance must remain borderless, shadowless, and backgroundless so it does not become a card within the header card.

## Evidence inspected

- Fresh overview capture: `.omo/evidence/student-header-overview-current.jpg` (JPEG, 1280x720, SHA-256 `033cc79f…e7b4d499`)
- Fresh store capture: `.omo/evidence/student-header-store-current.jpg` (JPEG, 1280x720, SHA-256 `173046e5…6bdcff2`)
- Current dirty-worktree diff against `HEAD~1` (20 tracked files; header-relevant files and full CSS diff inspected) and `git diff --check`.
- [DESIGN.md](../../DESIGN.md) token/contract entries.
- [StudentHeader.tsx](../../src/components/student/StudentHeader.tsx:20), [StudentBalanceSummary.tsx](../../src/components/student/StudentBalanceSummary.tsx:23), [StudentOverviewPage.tsx](../../src/components/student/StudentOverviewPage.tsx:102), and [StudentStorePage.tsx](../../src/components/student/StudentStorePage.tsx:55).
- [index.css](../../src/index.css:14252) base material/border rules and [the Chromebook override](../../src/index.css:16516).

## Findings

### CRITICAL

None. The headers are live React DOM: `StudentOverviewPage` and `StudentStorePage` both render the reused `StudentBalanceSummary` primitive; `StudentStorePage` composes it through `StudentHeader`. No header or balance screenshot/raster/background-image substitution was found.

### HIGH

None. At the active compact breakpoint, both outer surfaces are driven by `--student-header-height: 4.5rem` and `--student-card-radius: 1.25rem` ([index.css](../../src/index.css:16517)); both resolve to the same 72px outer geometry. Their 1px border and `color-mix(... var(--apple-material-thick) 94% ...)` material are the same ([base header](../../src/index.css:14252), [overview override](../../src/index.css:16601)). The values use the documented semantic geometry/material/border system, not one-off header colors.

### MEDIUM

None. The captured results show no clipped title, label, amount, or reserved-balance value. The store preserves its back action and title, and its nested balance visibly carries the same `사용 가능 고마`/value and `예약 고마`/value hierarchy as the overview.

### LOW

- The supplied actuals are 1280x720, while `DESIGN.md` names 1280x800 as the authoritative student layout. This is an evidence-coverage limitation, not a visible defect: the applicable CSS condition is `min-width: 64rem` and `max-height: 53.125rem` ([index.css](../../src/index.css:16516)), so both 720px and 800px heights receive the same header contract. A future visual-QA run should still archive a 1280x800 screenshot.

## Structural checks

- `StudentBalanceSummary` is one shared primitive for both surfaces, including the exact same label/value markup ([StudentBalanceSummary.tsx](../../src/components/student/StudentBalanceSummary.tsx:29)).
- The overview renders it as its own outer header surface ([StudentOverviewPage.tsx](../../src/components/student/StudentOverviewPage.tsx:102)); the compact layout gives it the shared 72px token, semantic 1px separator, common 20px radius, and common material ([index.css](../../src/index.css:16597)).
- The store renders the same primitive inside the reusable `StudentHeader` action slot ([StudentStorePage.tsx](../../src/components/student/StudentStorePage.tsx:55)). Its parent header receives the same 72px/radius contract ([index.css](../../src/index.css:16548)), while the child explicitly has `border: 0`, transparent background, and `box-shadow: none` ([index.css](../../src/index.css:14288)).
- The `3.25rem` nested balance minimum ([index.css](../../src/index.css:16571)) is internal content sizing only. It does not change either 72px outer header surface and is visually consistent with the no-card-in-card treatment.

## Blockers

None.

## Verification limitation

I inspected the supplied fresh rendered captures and the current source/diff. A new isolated browser session could not be driven in this environment because no Playwright package or browser-control connector was available; therefore this report does not claim a newly generated runtime screenshot. No user data or live classroom state was changed.
