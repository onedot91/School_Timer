# Student overview balance-header clone-fidelity review

- Date: 2026-08-13 (Asia/Seoul)
- Mode: final read-only re-review. No student control was clicked and no application data was changed.
- Recommendation: **APPROVE**

## Goal and target

The target is the explicit current requirement: at `localhost:3000/#student-overview`, the student balance summary must be a live, full-width top header at `1280×800` CSS px. The remaining overview structure must retain a live scene, right-side emotion/pet status, and two bottom destination cards.

The older supplied clipboard capture at `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-e0559489-4942-4686-91f5-672fde9c6ac7.png` places the balance in the prior right column. I inspected it, but did not treat that superseded placement as evidence for the revised header contract.

## Evidence inspected

1. Current worktree status plus the full scoped diff for `DESIGN.md`, `src/components/student/StudentOverviewPage.tsx`, and `src/index.css`; `git diff --check` completed without whitespace errors.
2. [DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:77), including the pre-existing `--student-balance-compact-height`, and the four documented Chromebook overview tokens at [lines 88-91](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:88).
3. [StudentOverviewPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx:101) and reused [StudentBalanceSummary.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBalanceSummary.tsx:23).
4. [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16467), including token declarations at lines 16472-16475 and consuming overview rules at lines 16563-16620.
5. Fresh, non-interactive in-app-browser render of `http://localhost:3000/#student-overview` at exactly `1280×800` CSS px in this review:
   - document: `1280×800`, `scrollWidth=1280`, `scrollHeight=800`;
   - balance header: `(12,12) 1256×64`, first visible overview region and full content width;
   - hero: `(12,88) 1256×576`; scene `829.33×466.49`; right status column `414.66×576`;
   - destination row: `(12,676) 1256×112`, with two `622px` cards;
   - header/hero, hero/destination, and header/destination intersections were all `false`; browser console had no warnings or errors.
6. Fresh live DOM snapshot: one `section[aria-label="고마 잔액"]` at the overview root, live text and inline SVG, a live scene region with hotspot buttons, live emotion/pet regions, and two live destination sections. The only raster backgrounds are bounded scene/egg artwork assets; the header itself has `background-image: none`.
7. `npm run lint` completed successfully (`tsc --noEmit`).
8. Existing reports and `.omo/ulw-loop/notepad.md` were read only as untrusted context, not accepted as proof.

## Result

The full-width balance header is implemented by moving the reused `StudentBalanceSummary` primitive before the hero ([StudentOverviewPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx:104)). At the requested viewport it occupies the top layer, while the scene/status layer and the two destination cards remain fully visible, separate, and within the viewport.

The previously blocked Chromebook overview dimensions are now semantic, documented tokens and are consumed by the active CSS: action height ([DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:88), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16472), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16564)), header block padding ([DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:89), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16473), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16570)), card padding ([DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:90), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16474), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16605)), and card title size ([DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:91), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16475), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16620)). The balance header height is likewise driven by the existing documented `--student-balance-compact-height` token ([index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16564)).

## Findings

### CRITICAL

None. The page is not a pasted screenshot or page-sized raster substitute; the requested header and actions are live DOM rendered through existing primitives.

### HIGH

None. The four previously un-tokenized Chromebook overview dimensions are now documented semantic tokens and are used by the current layout.

### MEDIUM

None. No layer collision, document overflow, console warning/error, or clipped visible copy was observed at `1280×800`.

### LOW

None.

## Blockers

None.

## Verification limit

No separate revised-layout pixel reference was supplied; visual fidelity was therefore evaluated against the explicit full-width-top-header target and the observed `1280×800` geometry. No data-mutating control, navigation action, or file outside this evidence artifact was changed.
