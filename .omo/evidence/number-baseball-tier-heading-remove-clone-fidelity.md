# Visual QA Pass B — number-baseball-tier-heading-remove

**Verdict:** REVISE  
**Scope:** Four post-edit captures, the number-baseball history component, relevant CSS, and `DESIGN.md`.

## Evidence inspected

- `.omo/evidence/number-baseball-tier-heading-remove/number-baseball-tier-heading-remove-1024.jpg` — JFIF JPEG, 860×672, modified 2026-08-20 14:06:43; source modified 14:05:41.
- `.omo/evidence/number-baseball-tier-heading-remove/number-baseball-tier-heading-remove-1280.jpg` — JFIF JPEG, 1075×672, modified 2026-08-20 14:06:43.
- `.omo/evidence/number-baseball-tier-heading-remove/number-baseball-tier-heading-remove-1366.jpg` — JFIF JPEG, 1147×672, modified 2026-08-20 14:06:44.
- `.omo/evidence/number-baseball-tier-heading-remove/number-baseball-tier-heading-remove-effective-512.jpg` — JFIF JPEG, 430×672, modified 2026-08-20 14:06:44.
- `src/components/student/StudentNumberBaseballHistory.tsx:14-52`.
- `src/components/student/StudentNumberBaseballPage.tsx:134-225`.
- `src/index.css:15199-15430,18338-18372`.
- `DESIGN.md:180`.

## Findings

### CRITICAL

None.

### HIGH

- [product] **1024px viewport clips the last reward group.** In `number-baseball-tier-heading-remove-1024.jpg`, the 8회/9회 cards are visibly cut at the bottom edge before their dashed-card lower boundaries and content finish. At desktop widths the enclosing student page is explicitly `overflow: hidden !important` (`src/index.css:18338-18353`) and the baseball main region also uses `overflow: hidden` (`src/index.css:15199-15203`); its scroll fallback begins only at `max-width: 48rem` (`src/index.css:15411-15415`). Therefore this is a rendered, not merely screenshot, overflow risk at the requested 1024px width. It violates the no-clipping requirement and prevents a clear view of attempts 8–9.

### MEDIUM

None.

### LOW

None.

## Confirmed correct

- The visible tier headings `1~5회`, `6~7회`, and `8~9회` are absent in all four captures. The live history component renders only the reward span in each tier header (`StudentNumberBaseballHistory.tsx:24-26`); the attempt rows retain their individual `1회` through `9회` labels (`:34,41`).
- Reward pills remain live, clear, and ordered: `+15 고마`, `+10 고마`, `+5 고마`. The two full desktop captures retain all three in descending reward / chronological-attempt order; the 512px capture preserves the first pill and source proves all tiers use the same mapped live DOM structure.
- At 1280px, 1366px, and the visible 512px region, cards do not overlap, no horizontal overflow is apparent, and Korean copy has natural, unsplit wrapping. No screenshot substitutes for the component tree: the DOM is generated from `NUMBER_BASEBALL_REWARD_TIERS` and attempts in `StudentNumberBaseballHistory.tsx:18-47`.

## Blocker

1. [product] Resolve the 1024px vertical clipping/accessibility of the 8–9 attempt group, then recapture all four stated widths for a fresh approval.
