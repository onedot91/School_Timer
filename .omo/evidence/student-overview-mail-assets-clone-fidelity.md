# Student overview mail assets — fresh clone-fidelity review

- Review date: 2026-08-13 (Asia/Seoul)
- Scope: read-only final review of the student overview's supplied 16:9 mail-state canvas assets. The only navigation action was selecting student `1` in an isolated Chrome profile; no balance, mail, pet, purchase, emotion, bid, or other data-mutating control was used.
- Recommendation: **APPROVE**

## Goal and success criteria

Replace the student overview's 16:9 canvas background with the exact user-provided assets:

- unread: `/Users/ibyeonghyeon/Downloads/집앞/집터2(알림).png`
- no unread: `/Users/ibyeonghyeon/Downloads/집앞/집터2(알림X).png`

Approval requires exact asset fidelity, `data-unread-mail="true"` mapping to the unread asset, a live (not screenshot-substituted) canvas with preserved overlays/hotspots, and a correct live no-unread render at `1280×800`.

## Evidence inspected

1. Both user reference PNGs above.
2. Source assets: `public/student-home-mail-unread.png` and `public/student-home-mail.png`.
3. Files served by the running app:
   - `http://127.0.0.1:3000/student-home-mail-unread.png`
   - `http://127.0.0.1:3000/student-home-mail.png`
4. Fresh live browser capture: `/private/tmp/student-overview-no-unread-1280x800.png`.
5. Relevant source and current worktree diff:
   - `src/components/student/StudentPetStage.tsx:9-23,108-211`
   - `src/components/student/StudentOverviewPage.tsx:101-155`
   - `src/pages/AuctionPage.tsx:471-473,1361-1369`
   - `src/lib/studentLife.ts:128-130`
   - `src/index.css:12034-12039,14337-14350,16236-16240,16580-16584`
   - `DESIGN.md:58-81` (the named 16:9 stage-ratio token)
   - `git status --short`, the full relevant asset/state-path diff, and `git diff --check`.
6. Notepad inspected: `.omo/ulw-loop/notepad.md`; it concerns a separate historical debug task and adds no acceptance criterion for this asset replacement.

Prior reports and screenshots under `.omo/evidence` were treated as untrusted and were not used as pass evidence.

## Verified results

### Exact asset and served-file fidelity — PASS

All four PNGs are `1920×1080` (16:9), have no alpha channel, and the source/served copies are byte-identical to the respective user reference.

| State | Reference SHA-256 | Public SHA-256 | Served SHA-256 | Result |
| --- | --- | --- | --- | --- |
| unread | `775cd45e55bd108e8d9745a161528612408aaeae9aeb838901e0c7659027cef8` | same | same | exact bytes, `1920×1080` |
| no unread | `2f93ccc2e6e7414cfedfc40d95ef6a78d84d467d1c8902c0e61be0704554fa19` | same | same | exact bytes, `1920×1080` |

`cmp -s` returned exit code `0` for each reference/public pair. Byte identity is stronger than a pixel comparison: it proves every pixel and PNG payload match the user-provided original.

### State mapping — PASS

- `getUnreadStudentLetterCount` counts only letters addressed to the active student whose `readAt` is `null` (`src/lib/studentLife.ts:128-130`).
- `AuctionPage` derives `hasUnreadMail` from that count (`src/pages/AuctionPage.tsx:473,1365`).
- `StudentPetStage` renders that boolean as the actual DOM attribute `data-unread-mail={hasUnreadMail ? 'true' : 'false'}` (`src/components/student/StudentPetStage.tsx:108-125`).
- CSS maps the default/read attribute state to `/student-home-mail.png` and only `[data-unread-mail="true"]` to `/student-home-mail-unread.png` (`src/index.css:12034-12039`; the final theme layer repeats the same mapping at `16236-16240`).

No real unread letter was created. The unread conclusion rests on this end-to-end production state path, its DOM attribute, the CSS selector, and the exact served unread file.

### Live no-unread 1280×800 canvas — PASS

Fresh isolated-browser results after selecting only student 1:

- URL: `http://localhost:3000/#student-overview`
- viewport: `1280×800`
- canvas attribute: `data-unread-mail="false"`
- computed background: `url("http://localhost:3000/student-home-mail.png")`
- computed aspect ratio: `16 / 9`
- canvas bounds: `829.328125×466.484375` at `(12, 142.75)`
- document/client dimensions: all `1280×800`; no horizontal or vertical document overflow
- browser errors: none (only Vite and React DevTools informational console messages)

The capture visibly shows the supplied no-unread art at the full canvas bounds. Its house, student character, mailbox hotspot, and library hotspot remain live foreground DOM, not pixels baked into a whole-page screenshot.

### Component tree, layers, and design-system use — PASS

This is not a fake screenshot implementation:

- `StudentOverviewPage` composes the overview from balance, stage, emotion, pet, and destination primitives (`src/components/student/StudentOverviewPage.tsx:101-155`).
- The bounded raster is exactly the user-requested *canvas background*, while `StudentPetStage` retains a real house `<img>`, two real mailbox/library `<button>` hotspots, and a real movable character `<button>` (`src/components/student/StudentPetStage.tsx:116-166`). The observed hotspot bounds are within the canvas and align with the depicted mailbox and bookstore.
- Canvas geometry is token-driven through `--student-character-stage-aspect-ratio` (`DESIGN.md:58-81`, consumed at `src/index.css:14337-14350` and `16580-16584`). The asset-state rules introduce no one-off color, spacing, or typography values; they only select the requested state-specific image URLs.

Using `background-image` here is appropriate and required by the task: it is a bounded scene layer behind reusable, interactive DOM, not a raster substitute for the product UI.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Blockers

None.

## Review boundary

The worktree contains unrelated, uncommitted redesign changes. This review examined their shared overview/layout context only where it could affect the stated mail-canvas requirement; it does not approve unrelated features. The expected clean-profile number-selection screen was navigated by selecting student 1 and is not a blocker.
