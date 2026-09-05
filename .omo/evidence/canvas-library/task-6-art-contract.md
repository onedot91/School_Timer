# Task 6: library shelf art contract synchronization

Date: 2026-09-05 (Asia/Seoul)

## Scoped change

- Edited only `DESIGN.md` §9. The contract now requires the placement dialog to be an enlarged wood bookcase with continuous planks and dark recesses, narrower 5/4-column variants, transparent 44px semantic hit cells, quiet empty-spine outlines, and a readable contextual caption.
- It now fixes the shared book representation: placed student books are vertical narrow spines in both Canvas and dialog; `slotId % 3` selects coral/blue/sage; page count determines bounded deterministic thickness; selected metadata is semantic/readable; horizontal covers remain table-prop-only.
- No production code, asset, dependency, browser, server, or cleanup resource was created by this documentation-only task.

## Document/manual-QA audit (not a visual approval)

| Scenario | Inspection | Observable source fact | Verdict |
| --- | --- | --- | --- |
| Renderer placed-book rule | `src/components/student/library/CanvasLibraryRenderer.ts:445-470`, `drawPlacedBook` | Resolves a slot, uses `slotId % 3` for coral/blue/sage and bounded `pageCount` thickness, then draws a narrow vertical spine. | Contract match confirmed |
| Semantic slot structure | `src/components/student/library/CanvasLibraryGame.tsx:637-678` | A shelf-specific grid renders semantic buttons; each carries one spine state, deterministic tone/thickness attributes, and selected-slot caption data. | Contract match confirmed |
| Bookcase/recess and hit-cell treatment | `src/index.css:1316-1505` | 10/5/4-column widths are distinct; slot grid uses timber planks/dark recess; slot buttons have transparent backgrounds and `min-height: 44px`; empty/occupied spines and readable caption have separate rules. | Contract match confirmed |

This is a documentation-channel source audit only. It does **not** claim a visual PASS for the current root student-23 slot PNGs: the supplied old card-grid captures are RED and are not final acceptance evidence. The later visual gate must inspect fresh placement-modal states after the contract is implemented/verified on the actual surface.

## Verification

- Invocation: `git diff --check`.
- Required binary observable: empty output and exit code 0.
- Invocation: `git diff -- DESIGN.md` plus direct read of this report.
- Required binary observable: only the scoped §9 contract addition and this task-6 evidence file describe the refinement; no unrelated design rule changed by this task.
- Result: `git diff --check` completed with empty output and exit code 0. The scoped diff contains the bookcase/spine/caption contract; this report is non-empty. Visual acceptance remains pending by design.

## Addendum: movement-arrow override (2026-09-05)

- Latest user override supersedes the earlier persistent pointer-pad requirement. `DESIGN.md` §9 now prohibits persistent on-screen movement arrows and any replacement movement toolbar.
- Keyboard Arrow/WASD movement, `E`/Enter contextual interaction, and in-range Canvas shelf clicks remain contracted. Pointer input is restricted to visible contextual/back/status controls and in-range shelf interaction; it cannot direct movement or start hidden/autonomous movement.
- Manual-QA file/data channel: `rg -n 'directional|방향|pointer' DESIGN.md` must show no active Canvas requirement to render a persistent four-button movement pad. Root's final browser QA, not this documentation task, must verify that no four movement buttons remain on the surface.
- This is document-only; no resources were created and no cleanup is required. Runtime/input parsing/network/persistence checks remain not applicable.
