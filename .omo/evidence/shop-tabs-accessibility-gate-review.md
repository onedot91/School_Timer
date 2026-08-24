# Non-stock shop tabs accessibility — gate review

## recommendation

APPROVE (code/behavior gate). Exact primary visual QA remains incomplete and is not claimed as PASS.

## blockers

None.

## originalIntent

Convert the three non-stock shop controls (items, character gacha, houses) into an accessible ARIA tab interface with one tab stop, keyboard selection/focus movement for ArrowLeft, ArrowRight, Home, and End, and correct selected-tab/panel relationships, without changing visible labels or the existing stock iconography.

## desiredOutcome

- The tab container exposes `role="tablist"` and an accessible label.
- Each tab exposes `role="tab"`, `aria-selected`, a roving `tabIndex`, and `aria-controls` targeting its selected panel.
- ArrowLeft/ArrowRight wrap through the three tabs; Home selects/focuses items; End selects/focuses houses.
- The rendered items, character, and houses surfaces expose matching `role="tabpanel"`, `id`, and `aria-labelledby` relationships.
- Visible tab text and icon components remain unchanged.

## userOutcomeReview

PASS for the focused code/behavior outcome. `StudentShopPage.tsx` defines a stable three-tab order, updates both selection and focus for all four required keys, prevents the handled browser defaults, and retains exactly one `tabIndex={0}` tab. All three tab `aria-controls` values match the conditionally rendered panel IDs, and each panel points back to its controlling tab. `StudentCharacterGacha.tsx` preserves its standalone heading fallback while accepting the shop panel ID and tab label when embedded. Comparison with `HEAD` confirms the visible labels (`물품`, `고마 스킨 뽑기`, `집`) and the tab icons (`Package`, `Gamepad2`, `Hammer`) are unchanged; only `aria-hidden="true"` was added to those decorative icons. No stock icon implementation is touched by the focused two-file diff.

The supplied browser behavior record is consistent with the implementation: initial items, ArrowRight to selected/focused characters with its matching panel, End to houses, and Home back to items. However, no dedicated browser log or screenshot artifact for this focused change was found under `.omo/evidence`; this report therefore treats source inspection and the independently reproduced project gates as primary evidence, not the unlocated browser prose.

## successCriteriaReview

- SC-1 ARIA tablist and tabs: PASS — `src/components/student/StudentShopPage.tsx:95-98`.
- SC-2 roving tabindex: PASS — `src/components/student/StudentShopPage.tsx:96-98` binds the sole zero tabindex to the selected tab.
- SC-3 ArrowLeft/ArrowRight/Home/End movement: PASS — `src/components/student/StudentShopPage.tsx:73-89`; selection and focus move together, with horizontal wraparound.
- SC-4 selected panel linkage: PASS — items at lines 102, characters through `StudentCharacterGacha.tsx:169-175`, and both houses branches at lines 171/182 match tab IDs and controls.
- SC-5 no visible text or stock icon change: PASS — direct `git diff`/`git show HEAD` comparison of the two scoped files. Visible tab copy and Lucide icon components are unchanged; the diff contains no stock component/icon change.
- SC-6 project validation: PASS — `npm test -- --run` reports 157/157 passing; `npm run lint` (`tsc --noEmit`) exits 0; `npm run build` exits 0 with only the existing-style chunk-size warning.
- SC-7 exact primary visual QA at 1280×800 and 100%: INCOMPLETE — the reported browser viewport was 1075×672 from a nominal 1280×800 scaled preview. No visual PASS is issued.

## directSlopAndProgrammingPass

No blocking overfit/slop issue found. The change adds no deletion-only, requested-removal, tautological, prose-pin, or implementation-mirroring tests; indeed, it adds no test file. The keyboard handler is necessary production behavior and does not introduce speculative parsing, normalization, extraction, dependency, dead code, comments, logging, type suppression, or public API breakage. The optional gacha panel props preserve the component's existing standalone accessible-name behavior.

`StudentCharacterGacha.tsx` measures 261 nonblank/non-comment lines, above the programming skill's 250-line advisory threshold. This is pre-existing module size and the focused diff only adds the embedding accessibility contract; because module size is not a stated success criterion, it is a NOTE rather than a blocker. `StudentShopPage.tsx` measures 200 lines.

No dedicated code-review report covering the programming and remove-ai-slops perspectives was found for this focused change. The gate review performed both checks directly; absence of the separate report is an evidence gap, not a failed stated criterion.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentShopPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentCharacterGacha.tsx`
- `git diff -- src/components/student/StudentShopPage.tsx src/components/student/StudentCharacterGacha.tsx`
- `git show HEAD:src/components/student/StudentShopPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/package.json`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence` (searched for focused QA/code-review artifacts)

## exactEvidenceGaps

- No exact 1280×800 CSS viewport at 100% post-change visual observation; reported effective viewport is 1075×672. This prevents visual approval but does not contradict the focused code/keyboard criteria.
- No located dedicated browser action log or capture for the supplied initial/ArrowRight/End/Home sequence.
- No focused automated UI regression test exercises tab semantics and keyboard behavior; the 157 passing tests are domain/project regression coverage, not direct tab interaction coverage. The supplied manual behavior evidence plus direct source inspection supports this gate, but a future regression would be better protected by a DOM-level interaction test.
- `omo ulw-loop status --json` could not be run because `omo` is not installed (`command not found`), so the required fallback report path was used.

