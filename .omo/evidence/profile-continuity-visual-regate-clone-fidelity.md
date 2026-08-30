# Profile continuity visual re-gate — clone fidelity report

**Recommendation:** APPROVE  
**Verdict:** PASS  
**Scope:** Fresh visual and CJK re-gate of the random-profile arcade dialog at `1280×800`.

## Evidence inspected

- Current implementation: `src/components/student/StudentProfileGachaDialog.tsx` (especially lines 37–89, 116–125, 205–230, and 322–460).
- Current styling/token system: `src/index.css` (especially lines 23032–23468; base cream/mint tokens at 12583–12706 and 17123, 17159–17161).
- Current design contract: `DESIGN.md:303`.
- Runtime integration and authoritative purchase path: `src/components/student/StudentShopPage.tsx:266–273`, `src/lib/studentProfilePurchase.ts:102–154`.
- Static behavioural coverage: `src/lib/studentShopPresentation.test.ts:67–88`.
- Fresh full-motion captures, all verified as 1280×800 JPEG and newer than the reviewed source:
  - `tmp/visual-qa/profile-gacha/arcade-continuity-final-5/frame-0005.jpg`
  - `tmp/visual-qa/profile-gacha/arcade-continuity-final-5/frame-0015.jpg`
  - `tmp/visual-qa/profile-gacha/arcade-continuity-final-5/frame-0025.jpg`
  - `tmp/visual-qa/profile-gacha/arcade-continuity-final-5/frame-0030.jpg`
  - `tmp/visual-qa/profile-gacha/arcade-continuity-final-5/frame-0040.jpg`
  - `tmp/visual-qa/profile-gacha/arcade-continuity-final-5/frame-0047.jpg`
- Fresh reduced-motion capture, verified as 1280×800 PNG and newer than the reviewed source:
  - `tmp/visual-qa/profile-gacha/arcade-continuity-reduced-final-3/02-reduced-result.png`
- Type validation: `npm run lint` (`tsc --noEmit`) passed.

The tiny black capture-control pill at the bottom centre is excluded from assessment as instructed.

## Evidence trace

| Capture | Observed state | Continuity / CJK result |
|---|---|---|
| `frame-0005` | Fast reel | Dialog and clipped reel are centered; decoys travel only within the window. `어떤 친구가 나올까요?` and `카드가 빠르게 돌고 있어요.` are intact. |
| `frame-0015` | Deceleration | Same dialog/window/gate geometry; only the reel content changes. No clipping, overlap, scroll, or decoy-as-winner presentation. |
| `frame-0025` | Locked question card | Center card is approximately `200×200` at `(640,312)`; question face clearly covers the selection gate. |
| `frame-0030` | Authoritative hamster reveal | Same approximately `200×200` bounds and `(640,312)` centre as the locked card. Korean reveal copy is intact. |
| `frame-0040` | Reveal-complete/result handoff | The same hamster card remains at the same bounds while result copy/action occupy the space that was already reserved below; no upward jump. |
| `frame-0047` | Settled result | Fully composited 1280×800 result (individually re-opened); same dialog/card geometry as `frame-0040`, with no replacement card, overflow, or page scroll. |
| `02-reduced-result` | Reduced motion result | Same dialog/card geometry with a static penguin result. No reel travel, 3D flip, or transform artefact is visible; all Korean copy is intact. |

## Findings

### CRITICAL

None. The dialog is a live React/Motion component tree with semantic controls and image elements; no screenshot, raster overlay, or background-image substitutes for the interface.

### HIGH

None. The closed question face, revealed profile, and result view use one mounted arcade subtree. `stageLayoutKey` remains `arcade` for `shuffling`, `revealing`, and `result` (`StudentProfileGachaDialog.tsx:118–120, 282–285`), while one `.student-profile-gacha-winning-frame` carries both faces (`:377–428`). This removes the prior separate-card / vertical-jump failure mode.

### MEDIUM

None. The authoritative face is `receipt.profileImage` (`StudentProfileGachaDialog.tsx:425–427`), and the reel deck explicitly excludes that image (`:69–80`); therefore a decoy cannot be portrayed as the saved winner. The purchase path supplies the saved outcome from `onSelectProfile({ type: 'random' })` (`StudentShopPage.tsx:266–272`) and persists the selected `profileImage` before returning it (`studentProfilePurchase.ts:102–154`).

### LOW

- `src/index.css:23406–23447` contains unused legacy selectors (`.student-profile-gacha-outcome`, `.student-profile-gacha-result`, `.student-profile-gacha-result-glow`, `.student-profile-gacha-result-card`). This is a maintenance observation only: none renders in the current component and it has no visual or fidelity impact.
- `[evidence]` `frame-0040` is visually a reveal-complete/result handoff (result label and confirmation are already present), rather than a wholly pre-result frame as its supplied description suggests. `frame-0030` supplies the reveal state and `frame-0047` the settled state, so the seven-frame set still proves the required continuous transition. This is non-blocking capture-label imprecision, not a product defect.

## Design-system and layout assessment

- Color, material, typography, radius, shadow, and motion use existing cream/mint tokens such as `--apple-*`, `--failure-*`, `--student-store-soft`, and `--student-motion-*`; the new surface does not introduce one-off palette values.
- The fixed reel window (`src/index.css:23288–23302`), absolute 50%/50% winning frame (`:23372–23383`), and reserved 7rem copy/action region (`:23409–23419`) explain the visually invariant `200×200` focal card from locked through settled result.
- All observed Korean strings have natural phrase grouping, no clipped glyphs, no orphan syllables, and no overlap at the required viewport.
- The reduced-motion code bypasses shuffle travel (`StudentProfileGachaDialog.tsx:206–215`) and uses the 220ms opacity handoff, consistent with the static capture and `DESIGN.md:303`.

## Blocking list

None.

## Approval basis

Both independent read-only passes and this fresh source/capture inspection agree: the prior visual discontinuity is resolved, the displayed winner is authoritative, the 1280×800 output remains fully composed and unscrolled, and the cream/mint design system is implemented with live, token-driven DOM rather than a visual fake.
