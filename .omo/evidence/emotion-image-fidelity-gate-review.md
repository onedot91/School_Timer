# Emotion image fidelity and CJK precision gate review

- recommendation: REJECT
- visualVerdict: REVISE
- reviewedAt: 2026-08-10 (Asia/Seoul)
- reportPathFallbackReason: `omo ulw-loop status --json` could not run because `omo` is not available on PATH. No current ULW attempt directory could be resolved, so the required `.omo/evidence/<goal>-gate-review.md` fallback is used.

## blockers

### VF-ORDER-RED

- violatedCriterion: The red zone must render in the explicitly supplied order `분노하다, 신경질을 내다, 스트레스 받다 / 겁나다, 화나다, 불안하다 / 밉다, 짜증 나다, 걱정하다`.
- observation: The current desktop, tablet, and phone render `화나다, 겁나다, 불안하다` in the second row. The source array has `angry` before `scared`, so the requested `겁나다` then `화나다` order is not met.
- evidencePointer: `src/lib/studentEmotion.ts:63-65`; fresh browser DOM order at 1440x900, 768x1024, and 390x844 on `http://127.0.0.1:3003/`.

### VF-ASSET-CROP

- violatedCriterion: Validate the image-backed redesign against the supplied chart with faithful artwork and no visually broken fallback/substitute.
- observation: The PNGs are live images and all 36 current emotion requests load, but the files are coarse chart-cell crops rather than clean isolated character artwork. They retain neighboring artwork, dotted separators, and fragments of the chart's original Korean labels. The app then renders a second DOM label below each image, producing clipped/duplicated text and obvious artifacts at every tested viewport. `public/emotions/furious.png` visibly includes both neighbor steam marks and the top of the original `분노하다` label; the same artifact class is visible across red/yellow/blue/green cards, calendar miniatures, and selected artwork.
- evidencePointer: `public/emotions/furious.png`; `public/emotions/irritable.png`; `public/emotions/amused.png`; `src/components/student/StudentEmotionOrb.tsx:23-29`; fresh picker captures directly inspected at 1440x900, 768x1024, and 390x844.

## originalIntent

Independently validate the image-backed student emotion redesign against the supplied four-zone Korean emotion chart, including exact visible order, clean character imagery, CJK precision, responsive behavior, selection state, compact overview/calendar artwork, and usable touch targets.

## desiredOutcome

The 36 emotions appear in the stated 3x3 order per zone, using clean isolated artwork derived from the reference without generic icon fallback or crop debris. Desktop, tablet, and phone must have natural Korean rendering, no horizontal overflow, at least 44px interactive targets, functional mobile zone tabs, a clear selected/check state, and legible compact artwork in overview/calendar contexts.

## userOutcomeReview

The interaction/layout foundation is usable but the user-visible image fidelity is not ready to ship. All current emotion image URLs load, there is no generic Lucide fallback in the orb renderer, mobile zone tabs switch the live panel, selecting `안도하다` produced exactly one visible checked radio and one check badge, and 1440/768/390 runtime checks found no horizontal overflow or visible target below 44px. Korean DOM labels use `word-break: keep-all` and did not wrap unnaturally in the inspected captures.

However, the two defining fidelity requirements fail: the red order differs from the user's explicit sequence, and the raster assets visibly contain crop debris and duplicate label fragments. Compact calendar artwork inherits the same dirty crops. The overview compact control was verified as 76x76 and previously rendered the same asset path; during the final live pass the remote/shared state resolved to an empty emotion, so a fresh non-empty overview compact screenshot could not be reproduced without mutating user data.

## criterionReview

| id | criterion | result | evidence |
| --- | --- | --- | --- |
| VF-1 | Exact chart/order mapping | FAIL | Red row 2 is `화나다, 겁나다, 불안하다`; all other supplied zone orders match. |
| VF-2 | Image loading | PASS | Runtime `brokenImages: []` at 1440/768/390; 36 current IDs have corresponding PNG files. |
| VF-3 | No generic icon fallback | PASS | `StudentEmotionOrbVisual` renders only `/emotions/${emotion.id}.png` plus the selected `Check`; no image fallback path exists. |
| VF-4 | Clean reference-faithful artwork | FAIL | PNGs contain neighboring art, divider lines, and original label fragments; these are visibly duplicated by DOM labels. |
| VF-5 | Korean wrapping/CJK precision | PASS for DOM text, FAIL overall presentation through embedded label fragments | DOM labels remain intact; rasterized Korean fragments are clipped and duplicated. |
| VF-6 | 44px interaction targets | PASS | Fresh runtime geometry found no visible button below 44px; calendar nav measured 44x44, mobile zone tabs 48px min-height, emotion options over 100px, overview action 76x76. |
| VF-7 | Mobile zone tabs | PASS | 390px uses four visible tabs; selecting green switched the panel and selected tab. |
| VF-8 | Selected artwork/check state | PASS | Selecting `안도하다` yielded one visible `aria-checked=true` radio and one visible `.student-emotion-orb-check`. |
| VF-9 | Overview/calendar compact artwork | PARTIAL | Calendar compact images load at 160x128 intrinsic size and render in the calendar, but inherit crop artifacts. Overview target is 76x76; final non-empty visual could not be reproduced read-only after shared state resolved empty. |
| VF-10 | No horizontal overflow | PASS | `scrollWidth === innerWidth` at 1440, 768, and 390. |

## remove-ai-slops / programming direct pass

- Reviewed current production source, CSS, assets, available tests, and working-tree diff directly.
- No deletion-only, requested-removal, prose-pin, snapshot, tautological, or implementation-mirroring test was added for this image redesign.
- No generic fallback abstraction, image parser/normalizer, new dependency, `any`, `@ts-ignore`, or `@ts-expect-error` was introduced in the orb renderer.
- `StudentEmotionPage.tsx` and the feature-layer CSS are large maintenance notes, but file size is not a stated visual criterion and does not block this gate.
- The retained legacy `icon` union/fields are no longer used by the raster renderer and add maintenance burden, but this is a NOTE because it does not itself violate a stated criterion.
- Existing emotion gate reports explicitly contain programming and remove-ai-slops/overfit sections, but none covers the current chart-crop fidelity issue or serves as an exact-tree image-redesign code-review report. Their prior approvals were not trusted as proof.

## verification

- `npm run lint`: PASS (`tsc --noEmit`).
- `npm run build`: PASS; only the existing Vite chunk-size warning was emitted.
- Fresh browser QA: PASS for loading, responsive layout, target geometry, tabs, selection state, and horizontal overflow; FAIL for order and asset cleanliness.
- Direct reference inspection: `/Users/ibyeonghyeon/Downloads/ChatGPT Image 2026년 8월 10일 오전 12_53_39.png`.
- Direct asset inspection: `public/emotions/furious.png` at original resolution and the full rendered picker at all three viewports.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Downloads/ChatGPT Image 2026년 8월 10일 오전 12_53_39.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEmotion.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentEmotionOrb.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentEmotionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/public/emotions/` (36 PNG files)
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- Existing emotion gate reports under `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/`
- Current `git status`, scoped diff, lint output, build output, and live browser DOM/geometry results.

## exactEvidenceGaps

- No current ULW status/attempt path was available because the `omo` command is absent.
- No executor brief, exact-tree code-review report, manual QA matrix, or relevant notepad path was supplied or found for this specific image-backed redesign.
- The available tool surface did not expose a subagent launcher, so the `visual-qa` dual-oracle and reference-fidelity subagent passes could not be dispatched. This direct gate pass inspected the pixels and runtime itself.
- Browser screenshots were inspected live but not persisted as new files to preserve the read-only review constraint; the report artifact is the only authored repository file.
- A fresh non-empty overview compact artwork capture could not be reproduced after shared state resolved to empty without writing student data. Existing overview evidence was treated as untrusted supporting context only.

## requiredFixes

1. Reorder red entries so row 2 is exactly `겁나다, 화나다, 불안하다`.
2. Replace every chart-cell crop with a clean isolated transparent/solid-background character export containing no labels, grid lines, or neighboring pixels; keep labels solely in live DOM text.
3. Re-run fresh 1440/768/390 picker captures plus non-empty overview and calendar compact captures, then repeat image/CJK/target/overflow checks.
