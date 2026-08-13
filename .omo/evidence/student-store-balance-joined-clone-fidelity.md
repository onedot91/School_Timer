# Student store balance grouping — clone-fidelity review

## Verdict

**PASS** — confidence: **high**.

The fresh 1280×800 store capture directly satisfies the supplied visual intent: `사용 가능 고마` and `예약 고마` appear as adjacent, related blocks at the header’s right edge. There is no broad flexible void between them.

## Evidence inspected

- User-supplied intent in the review request: the two balance blocks must form an adjacent group with no broad flexible gap.
- Fresh capture opened at native resolution: `.omo/evidence/student-store-balance-joined.jpg` (1280×800).
- Design-system contract: `DESIGN.md:90-103`, `DESIGN.md:146-147`, `DESIGN.md:194-202`, and accepted legacy color-debt boundary at `DESIGN.md:216-224`.
- Implementation tree: `src/components/student/StudentStorePage.tsx:54-68`, `src/components/student/StudentBalanceSummary.tsx:20-43`.
- Store-scene structure: `src/components/student/StudentPlaza.tsx:15-40`.
- Relevant styles: `src/index.css:14276-14302`, `src/index.css:14431-14530`, and the 1280×800 compact-height override at `src/index.css:16555-16586`.
- In-scope diff: `git diff -- src/index.css`.

## Direct visual inspection

- Header alignment: the back control, `고마쓰기` title, and right-aligned balance group fit cleanly on one header baseline; no collision or detached header element is visible.
- Balance grouping: the two blocks are directly adjacent; the visible separation is approximately the stated 12 px. No unused flexible region separates the available and reserved amounts.
- Korean text: `홈`, `고마쓰기`, `사용 가능 고마`, `150 고마`, `예약 고마`, and `0 고마` are complete, single-line where expected, and show no glyph clipping, wrapping, or overlap.
- Overall regression: the header stays within the 1280 px canvas and the store scene begins below it with consistent inset/alignment. No horizontal clipping or visible horizontal overflow is present in the capture.

## Implementation integrity

- The screen renders the live `StudentBalanceSummary` React component rather than a header screenshot or raster substitute (`StudentStorePage.tsx:60-67`; `StudentBalanceSummary.tsx:20-43`).
- The balance hierarchy is semantic live DOM (`section`, labels, values, Lucide `Coins` icon) and the targeted styles use established system color/radius/shadow/font tokens alongside the project’s existing component spacing conventions (`src/index.css:14289-14302`, `14431-14530`).
- The source change removes the previous full-width balance summary in the store header and uses an auto-width summary aligned by the header action container (`src/index.css:14283-14296`), which matches the capture.
- The plaza artwork is a designated illustration, not a page-screenshot substitution: real `button` hotspots are layered over it (`StudentPlaza.tsx:15-40`), while the reviewed header/balance group remains live DOM.

## Findings by severity

### CRITICAL

None. No pasted screenshot/raster substitute or non-live balance UI was found.

### HIGH

None. The target grouping is present and no broad flexible void remains.

### MEDIUM

None in the reviewed 1280×800 state.

### LOW

None.

## Blocking

None.

## Scope note

This is a targeted fidelity review of the supplied fresh 1280×800 store capture and its directly responsible source. The reference was supplied as a textual visual requirement rather than an image artifact, so exact pixel-difference comparison against an external reference image was not possible; the stated grouping requirement itself is visibly met.
