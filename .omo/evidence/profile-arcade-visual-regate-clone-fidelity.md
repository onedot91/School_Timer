# Profile gacha arcade — clone/design-system fidelity regate

Recommendation: **APPROVE**

Scope: final profile-gacha arcade modal at the required 1280×800 viewport. This was a read-only review of the live React/CSS implementation and the supplied final normal/reduced-motion capture sequence.

## Evidence inspected

- `src/components/student/StudentProfileGachaDialog.tsx` (latest source mtime: 2026-08-30 19:37:13)
- `src/index.css` and `DESIGN.md` (the latter mtime: 19:37:41)
- `tmp/visual-qa/profile-gacha/arcade-final-8/01-confirm.png`
- `tmp/visual-qa/profile-gacha/arcade-final-8/02-saving-250.png`
- `tmp/visual-qa/profile-gacha/arcade-final-8/03-reel-fast-900.png`
- `tmp/visual-qa/profile-gacha/arcade-final-8/04-reel-decelerating-1850.png`
- `tmp/visual-qa/profile-gacha/arcade-final-8/05-reveal-mid-2550.png`
- `tmp/visual-qa/profile-gacha/arcade-final-8/06-result-3100.png`
- `tmp/visual-qa/profile-gacha/arcade-final-8/profile-gacha-arcade-demo.gif`
- `tmp/visual-qa/profile-gacha/arcade-reduced-harness-final-4/02-reduced-result.png`

All supplied PNGs are genuine 1280×800 PNGs and the demo is a 1280×800 GIF. Their mtimes (19:38–19:39) are later than the scoped source/design mtimes. The tiny bottom-centre black capture-control pill was excluded from product assessment as instructed.

## CRITICAL

None. The dialog is a real component tree: stage-specific React DOM, `<img>` profile assets, live buttons, a motion reel, a selection gate, and two flip faces render the surface. No pasted UI screenshot, raster background substitute, or `background-image` stand-in was found.

## HIGH

None. The cream/mint material is built from shared semantic tokens (`--apple-*`, `--student-store-soft`, `--failure-*`) rather than one-off hex colours: `src/index.css:23032-23142`, `src/index.css:23276-23419`. The modal anatomy, card primitive styling, reel clipping, gate, and result card are live reusable CSS structures.

`STUDENT_PROFILE_GACHA_MOTION` is the single numeric timing source at `src/components/student/StudentProfileGachaDialog.tsx:37-41`. Its matching `--student-profile-gacha-shuffle`, `--student-profile-gacha-reveal`, and `--student-profile-gacha-reduced` inline runtime custom properties are produced at `:44-52` and attached to the dialog at `:262-264`; values agree with `DESIGN.md:168-170`.

## MEDIUM

None. The normal flow is actually staged, not a static representation: authoritative save precedes the reel (`StudentProfileGachaDialog.tsx:176-228`); the transforms/times encode reverse anticipation, fast travel, and subsequent shorter travel distances (`:53-61`, `:334-342`); the centre gate has an explicit final pulse (`:354-368`); and the reveal is a perspective/backface 3D flip whose `layoutId` preserves card identity into the stable result (`:392-459`, `src/index.css:23369-23419`). The ordered normal captures visibly corroborate every stated phase.

The reduced-motion branch skips shuffling (`StudentProfileGachaDialog.tsx:83-89`, `:203-213`) and switches reveal/result animation to opacity without `rotateY`, spring, or stagger (`:385-428`, `:448-459`). The reduced-motion final capture is stable and clean.

At 1280×800, each inspected state is fully composed: no dialog clipping, overlap, unintended document scroll, or CJK glyph/wrapping corruption was visible. The capture sequence maintains a consistent cream/mint hierarchy and clear centre focus through confirmation, saving, reel, reveal, and result.

## LOW

- [evidence] Static final stills and code inspection prove the emitted-property wiring and reduced-motion branch, but this review did not independently query the browser's computed-style panel while the animation was running. This is not a blocker because the inline style attachment and all consumers are directly inspectable in the production component, and the supplied fresh sequence agrees with the implementation.
- [product] The dialog remains a large single component (`src/components/student/StudentProfileGachaDialog.tsx:95-479`). This is a maintainability consideration only; it does not compromise the required design-system integrity or fidelity.

## What must not regress

- Keep the reel/gate/reveal as live DOM and asset elements, never replace the sequence with a captured image or canvas snapshot.
- Keep `STUDENT_PROFILE_GACHA_MOTION` and its three emitted custom properties in lockstep with `DESIGN.md`.
- Preserve the reduced-motion skip of reel travel and 3D rotation.

## Blockers

None.
