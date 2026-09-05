# Task 3 small-room integrity review

## Verdict

**REVISE** — the isolated room is functionally real and visually coherent, but the two new implementation modules exceed the required maintainability boundary by a large margin. This is a current small-room design-system gate finding, not a request to start the later 100-slot, persistence, or route-cutover work.

Recommendation: **REQUEST_CHANGES**

## Scope and evidence integrity

- Reviewed the task-1/2 contract and source: `canvasLibraryWorld.ts`, its 14-test suite, `CanvasLibraryGame.tsx`, `CanvasLibraryRenderer.ts`, `CanvasLibraryPalette.ts`, `useModalFocus.ts`, and the scoped CSS diff. The actual new source is untracked, so it was inspected with `git diff --no-index` as well as the normal working-tree diff.
- Current SHA-256 values exactly match `root-play-qa.json` (generated `2026-09-05T06:10:46.832Z`):
  - `canvasLibraryWorld.ts` `37694777158380f21ee7154e2f49ea1c95fc26949ed337a1453ceb4b16c966d3`
  - `CanvasLibraryGame.tsx` `11a40a021a2c17edf4a8f102334736fb05e4ce1ab3e56f42ba4a84820cf17c3a`
  - `CanvasLibraryRenderer.ts` `baf3fa7b5a93b6984b68d862fc0a937821464af9a47d76ac1312df65258705a0`
  - `CanvasLibraryPalette.ts` `30ef750ab37ffb6a977974e9423fa8f6f9e734c3f284895cedc2f66d4b00c1e3`
  - `useModalFocus.ts` `2e161b8d3e8f54b839e9cbdad243ed4873c2532c03a4f1213f770e7ad65307fa`
  - `src/index.css` `bc1c56b9355ca6f9cb2f127949e181ed6b0b56ee5d8645b98b9a32ac2be99bfd`
- Manual visual-QA coverage: **15/15** paths listed by `root-play-qa.json` were opened with `view_image`: empty, walking mid/settled, registration, invalid input, carry, slots, placement start/mid/settled, details, long details, text-200 top/actions, and reduced motion. All are valid 1280×800 scene captures. `text-200-actions` is the expected bounded dialog-scroll view, not compositor clipping.
- The scene is actual Canvas 2D rather than an imported/background image: the renderer receives a real canvas, creates a static tile cache, draws palette primitives, y-sorts entities, and the fixture imports the real game component. No dependency, network, image import, data write, or runtime resource was created by this review.

## Confirmed current-stage behavior

- The room uses the specified 624×376 logical canvas at 2× inside the fixed 12px perimeter; captures show no document overflow, clipping, or inherited header.
- The visual language is cohesive: all examined primitives use the named palette ramps, a shared pixel grid and upper-left light; the two shelf variants, desk, rug/table/bench, window/lamp, carry sprite, placed books, and target corners remain readable.
- The functional source is a genuine model/renderer/controller split: pure world operations own collision/range/placement, the renderer owns draw/cache/dispose, and the component owns RAF/input/modal state. It is not a static image fake.
- Independently ran `node --import tsx --test src/lib/canvasLibraryWorld.test.ts`: **14/14 passed**. It covers collision, normalised diagonals, malformed world input, substep tunnelling, interaction range, immutable placement, and the current 18 unique slots.
- Independently ran `npm run lint`, `npm test`, `npm run build`, and `git diff --check`: all succeeded. The test suite was **531 pass / 0 fail**. The expected handled test diagnostic from the weekly-mission negative path appeared, but did not fail the suite.
- Existing browser evidence remains trustworthy after hash comparison: actual movement → registration → carried draft → in-range shelf → placement → inspection; keyboard roving/focus containment/Escape return; blur clear/resume; literal untrusted author rendering; reduced motion; and 200% text stress were all recorded. I did not treat test count alone as approval.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. **[product] Oversized new controller and renderer prevent a maintainable reusable small-room foundation.** `src/components/student/library/CanvasLibraryGame.tsx:92-643` has **600** pure lines and `CanvasLibraryRenderer.ts:1-737` has **685** pure lines (both over the 250-line ceiling). The game file combines state ownership/RAF/input/pointer state, registration validation, controlled placement adaptation, focus integration, and all three dialogs. The renderer combines background tiles, static props, furniture, bear sprite, placed books, target HUD, and depth orchestration. Task 4 will add shelf variants and slots to these same files, so this is not harmless current-file bulk: it makes the promised reusable renderer/model harder to change and review before expansion.

   Concrete fix: split by real responsibility while preserving the existing contracts — e.g. game controller/input + semantic dialog components, and renderer room-base/furniture/sprite/HUD draw units behind one `createLibraryRenderer` facade. Do not replace this with a generic `utils` module or a visual snapshot workaround. Add focused renderer/controller behavior tests only where the split introduces a real observable seam.

### LOW / watch items (not small-room-stage blockers)

1. **[product] Controlled placement has a temporary source-of-truth split.** At `CanvasLibraryGame.tsx:99-100, 381-409, 585-587`, a successful `onPlace` result immediately updates `booksRef` for canvas drawing but slot labels still render from `props.books`. If the future controlled owner resolves `onPlace` without synchronously sending updated props, reopening the picker can display an occupied slot as `빈자리`; clicking is later rejected through the ref. The isolated task-3 fixture uses the local adapter and does not expose this. Resolve it as part of the explicitly later controlled/persistence adapter work, not by starting that work in this gate.

2. **[product] `CanvasLibraryGame.tsx:382-392` catches every controlled-placement rejection without narrowing.** It presents the appropriate generic retry text, but loses error classification. This is dormant in the local small-room adapter and is not a persistence-stage blocker; task 6 should return/handle a typed placement result rather than swallowing unknown failures.

## Skill-perspective check

This check **ran** after reading the available `omo:remove-ai-slops` and `omo:programming` instructions (including TypeScript rules).

- `remove-ai-slops`: no deletion-only tests, requested-removal tests, prompt/prose tests, implementation-constant mirrors, static screenshot substitutes, or needless production parsing/normalisation were found. The 14 world tests assert user-observable geometry/placement behavior rather than test-only data. However, the oversized new modules are structural complexity that should be corrected before extending the feature.
- `programming`: no `any`, unchecked cast, non-null assertion, `@ts-ignore`, or untyped persistence escape hatch was found in the reviewed new feature code. The code does violate the module-size perspective above; the broad `catch {}` is recorded as a later adapter watch item. The project’s existing `tsx`/Node test toolchain was retained rather than altered.

## Relevant unprobed / deliberately deferred scope

No claim is made for 100 slots, shared storage/CAS, retries, read-only/data-mode behavior, route cutover, or full-app integration; those are later plan tasks and are **not** blockers for this isolated small-room review. I did not start a server/browser or leave resources to tear down.

## Gate blockers

- **[product]** Split `CanvasLibraryGame.tsx` and `CanvasLibraryRenderer.ts` into coherent responsibility-owned modules so each stays within the 250 pure-LOC maintainability boundary, then rerun the current small-room functional/visual checks. No evidence blocker remains: source hashes and 15/15 captures are current.

## Adjudication: scope-priority reconciliation (supersedes the earlier gate verdict/blockers)

**Final task-3 verdict: PASS. Recommendation: APPROVE.**

The preceding module-size finding remains recorded as maintainability debt, but it is **nonblocking** for the read-only, 18-slot small-room gate. The task goal and plan require a real, coherent Canvas room and a meaningful world/renderer/controller ownership boundary; both are present. They do not prescribe a 250 pure-LOC completion condition. Applying the generic skill preference as a hard completion condition would require a substantial refactor outside the requested stage, contrary to this repository's scope rule to avoid large refactors without explicit authorization.

### Seven-check adjudication

1. **Source bounds only:** the inspected stage remains the current 18-slot isolated fixture. The reviewed source already separates pure world operations (`canvasLibraryWorld.ts`), renderer cache/drawing (`CanvasLibraryRenderer.ts`), and component lifecycle/input/modal ownership (`CanvasLibraryGame.tsx`). No concrete task-3 architecture invariant is violated merely because the latter two are long.
2. **No behavior/test change needed:** this is a verdict correction only. No product source, test, dependency, data, route, or configuration was changed.
3. **Dirty-worktree preservation:** unrelated dirty files and the existing untracked task files were only read. Nothing was reverted or cleaned.
4. **Receipt and regression integrity:** the seven current source hashes still exactly equal the stable `root-play-qa.json` receipt. The earlier independent `npm run lint`, 531-pass `npm test`, `npm run build`, 14-pass world test, and `git diff --check` evidence remain applicable because no source changed.
5. **Manual QA:** all 15 receipt-listed 1280×800 PNGs were personally inspected. No user-facing mismatch was found: the whole scene is visible and cohesive; movement, registration error, carry, slot picker, placement, inspection, literal hostile text, 200% dialog scrolling/actions, and reduced motion are represented. The browser receipt separately asserts zero overflow, no blocked request/error, actual book loop, modal freeze/focus return, and real blur/no-stuck-key. There is therefore no reproducible current task-3 functional or design-system defect to retain as a REVISE blocker.
6. **Specific evidence gaps, not inference from file size:**
   - `pointercancel` and `lostpointercapture` are handled in source at `CanvasLibraryGame.tsx:523-525`, but the recorded browser script does not dispatch either event. This is a narrow unexercised pointer-cleanup path, not evidence of failure.
   - Interaction range itself is covered by the world far/near unit test and real keyboard approach receipts. The script does not separately click the *canvas shelf hotspot* while in range; its pointer case uses the semantic nearby desk action. The source has the in-range canvas check at lines 335-346. This is a coverage gap only.
   - Unmount cleanup is implemented for RAF/renderer/listeners/timer at lines 248-252 and 285-292, but no browser evidence unmounts during a held pointer or a pending controlled `onPlace` promise. The isolated local adapter has no pending network state. This is a later controlled-adapter/lifecycle test opportunity, not a current observed defect.
7. **Artifact and cleanup:** this report is the only adjudication artifact changed. Resources created by this reconciliation: **none**.

### Nonblocking debt retained

- `CanvasLibraryGame.tsx` and `CanvasLibraryRenderer.ts` are large and should be decomposed only when a user-authorized task (such as the future shelf expansion) makes the ownership split necessary. Keep the existing concrete contracts rather than adding generic abstractions.
- The controlled-prop timing and broad error-catch observations remain deferred to the explicit later persistence/controlled-adapter stage; they were not exercised by the small local fixture and do not invalidate it.
