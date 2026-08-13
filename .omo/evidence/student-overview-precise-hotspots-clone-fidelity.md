# Clone Fidelity Review — student-overview-precise-hotspots

## Decision

- **recommendation:** APPROVE
- **VERDICT:** PASS
- **CONFIDENCE:** HIGH
- **BLOCKING:** None.

## Scope and success criteria

Review only the three overview-canvas interactive targets at the supplied `1159 × 652` stage size:

1. The mailbox target must wrap the mailbox rather than surrounding sky, tree, or ground.
2. The egg target must wrap the egg and its nest, excluding surrounding branches.
3. The bookstore target must wrap the bookstore, excluding excess sky and foreground.
4. Targets must be live, keyboard-focusable DOM controls; have small forgiving margins; not overlap; stay inside the stage; and leave visible Korean text unclipped.

## Evidence inspected

- Fresh actual capture: `.omo/evidence/student-overview-precise-hotspots-final.jpg` — verified JPEG, `1280 × 800`, modified `2026-08-13T19:52:52Z`; SHA-256 `185ac3095f23a70ab886050d930e5521379f558ccbcb2d66682e53823e7a25f3`.
- Reference artwork: `public/student-home-mail.png` — verified PNG, `1920 × 1080`; SHA-256 `2f93ccc2e6e7414cfedfc40d95ef6a78d84d467d1c8902c0e61be0704554fa19`.
- Render tree: `src/components/student/StudentPetStage.tsx:114-150`.
- Current coordinate/token and focus rules: `src/index.css:12034-12118`; stage geometry: `src/index.css:14401-14414`, `src/index.css:16644-16652`.
- Design-token contract: `DESIGN.md:74-89`.
- Relevant diff slices: `src/index.css`, `src/components/student/StudentPetStage.tsx`, `src/components/student/StudentOverviewPage.tsx`, and `DESIGN.md`.
- Notepad consulted: `.omo/notes/mission-feature-plan.md` (unrelated to this hotspot review; no conflicting requirement).

The older focus screenshot under `.omo/evidence/hotspot-sizing/` predates the current CSS and was deliberately not used as approval evidence.

## Geometry verification

Calculated from the current CSS custom properties, using the supplied `1159 × 652` stage:

| Target | CSS result (x, y, w, h) | Supplied metric | Result |
| --- | --- | --- | --- |
| Egg + nest | `(81.13, 104.32, 144.88, 91.28)` | `(82, 105, 144.6, 91)` | Matches within sub-pixel rounding. |
| Mailbox | `(92.72, 352.08, 162.26, 208.64)` | `(93.6, 352, 162, 208)` | Matches within sub-pixel rounding. |
| Bookstore | `(811.30, 273.84, 312.93, 247.76)` | `(811, 274, 312.4, 247)` | Matches within sub-pixel rounding. |

All bounds are contained in the stage. Egg-to-mailbox vertical separation is `156.48px`; mailbox-to-bookstore horizontal separation is `556.32px`; therefore the three targets cannot overlap at this stage size.

## Findings

### CRITICAL

None. The interactive areas are not a pasted screenshot or raster substitute: `StudentPetStage` renders separate semantic `<button>` elements for egg, mailbox, and bookstore at `src/components/student/StudentPetStage.tsx:130-137`, each connected to its real navigation/dialog callback.

### HIGH

None. The changed geometry is token-driven rather than scattered one-off dimensions: named CSS custom properties at `src/index.css:12035-12046` are consumed by the target selectors at `src/index.css:12065-12077` and documented in `DESIGN.md`.

### MEDIUM

None. Direct visual inspection of the fresh capture over the original artwork shows:

- Egg/nest: bounds hug the nest and egg, leaving only a narrow forgiveness band and avoiding the surrounding canopy/branches.
- Mailbox: bounds cover the full red mailbox and post with a small perimeter allowance; they do not reach the central house, library, or broad foreground.
- Bookstore: bounds cover roof, facade, shelves, door, step, and immediate edge greenery; they avoid the large sky and ground regions.

### LOW

None. At rest the targets are intentionally transparent (`src/index.css:12055-12063`), which matches the supplied capture. Keyboard focus remains a visible, bounded state on the same live button (`src/index.css:12113-12118`: 3px white border plus 3px accent outline); no evidence of clipping or spill into another target exists in the current layout rules.

## CJK and clipping check

The fresh capture contains the Korean labels `우편함` and `책방`. Both are fully visible, centered inside their illustrated forms, and show no clipped glyph, line split, or baseline loss. The stage edge, roof, mailbox post, and bookstore step are likewise visibly intact; no target creates visible overflow.

## Good, preserve

- Transparent resting targets keep the artwork readable.
- The shared `.student-home-hotspot` primitive provides real button semantics, a 44px minimum target, and consistent hover/focus behavior (`src/index.css:12055-12063`, `12113-12118`).
- The target coordinate contract remains explicit and reviewable in `DESIGN.md` rather than being hidden in an image map or canvas.
