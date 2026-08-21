# Bookshelf natural-fidelity manual QA

`omo ulw-loop status --json` was unavailable (`omo: command not found`), so this matrix uses the caller evidence-directory fallback `.omo/evidence/`. Product files and app data were not modified.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| BLF-FORMULA-01 | SC-THICKNESS | Student bookshelf live geometry helper | `node --import tsx --input-type=module -e "import {getBookSpineHeightPx} ..."` | PASS | `src-studentLife`, `src-studentLife-test`, `cmd-results` |
| BLF-LAYOUT-01 | SC-NATURAL-STACK | Student bookshelf layout helper and mapped `<article>` styles | `node --import tsx --input-type=module -e "import {getBookStackLayout} ..."`; source inspection of `StudentLibraryPage` | PASS | `src-studentLife`, `src-student-library`, `src-studentLife-test`, `cmd-results` |
| BLF-DESKTOP-1024 | SC-RESPONSIVE-CJK | Student bookshelf PNG capture, 1024 CSS px | Open/read `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1024.png` | PASS | `png-1024` |
| BLF-DESKTOP-1280 | SC-RESPONSIVE-CJK | Student bookshelf PNG capture, 1280 CSS px | Open/read `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1280.png` | PASS | `png-1280` |
| BLF-DESKTOP-1366 | SC-RESPONSIVE-CJK | Student bookshelf PNG capture, 1366 CSS px | Open/read `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1366.png` | PASS | `png-1366` |
| BLF-TEST-01 | SC-QUALITY | Focused and full Node test surfaces | `node --test --experimental-strip-types src/lib/studentLife.test.ts`; `npm test` | PASS | `src-studentLife-test`, `cmd-results` |
| BLF-TYPE-01 | SC-QUALITY | TypeScript project validation | `npm run lint` | PASS | `cmd-results` |
| BLF-BUILD-01 | SC-QUALITY | Production bundle build | `npm run build` | PASS | `cmd-results` |
| BLF-RUNTIME-CENTER-01 | SC-NATURAL-STACK / claimed runtime center range | Browser DOM/computed-style runtime | No faithful browser invocation or DOM measurement artifact available; only supplied PNGs and source were inspectable | FAIL — exact `9.38px` vs `59.25px` claim is not independently evidenced | `cmd-results`, `png-1024`, `png-1280`, `png-1366` |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| BLF-ADV-ADJACENT-PAGES | SC-THICKNESS | adjacent page counts | Valid counts 1, 2, 3 produce distinct increasing spine heights | PASS (source regression asserts monotonicity) | `src-studentLife`, `src-studentLife-test`, `cmd-results` |
| BLF-ADV-BOUNDS | SC-NATURAL-STACK | layout-boundary | Every layout remains within width `81–92%` and offset `-1–1%` | PASS | `src-studentLife`, `src-studentLife-test`, `cmd-results` |
| BLF-ADV-CYCLE | SC-NATURAL-STACK | deterministic repetition | Index 12 repeats index 0 without undefined layout | PASS | `src-studentLife-test`, `cmd-results` |
| BLF-ADV-CJK-OVERFLOW | SC-RESPONSIVE-CJK | long/CJK labels and overflow | Four-book fixture remains readable and contained at 1024/1280/1366 | PASS — visually inspected supplied PNGs; exact DOM bounds not measured | `src-student-library`, `src-index-css`, `png-1024`, `png-1280`, `png-1366` |
| BLF-ADV-REAL-DATA-MUTATION | project QA safety | live classroom mutation | QA must not alter balances, bids, awards, or currency history | not_applicable — bookshelf geometry is read-only and no mutation controls were invoked | `src-student-library` |
| BLF-ADV-RUNTIME-MEASURE | SC-NATURAL-STACK | unreliable/inferred runtime claim | A browser artifact must record computed heights and center range | FAIL — no browser/DOM action log or computed measurement artifact exists | `cmd-results` |

## artifactRefs

| id | kind | description | path |
| --- | --- | --- | --- |
| `src-studentLife` | source | Formula and bounded layout implementation | [`src/lib/studentLife.ts`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:43) |
| `src-studentLife-test` | source | Regression assertions for formula, monotonicity, bounds, and cycle | [`src/lib/studentLife.test.ts`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.test.ts:19) |
| `src-student-library` | source | Live DOM mapping of book data to inline geometry | [`src/components/student/StudentLibraryPage.tsx`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:51) |
| `src-index-css` | source | Shelf/spine layout, token palette, overflow rules | [`src/index.css`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12487) |
| `design-contract` | source | Documented 81–92%, -1–1%, and 18+0.6px/page contract | [`DESIGN.md`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:142) |
| `png-1024` | screenshot | Fresh 1024×768 bookshelf capture | [`tmp/bookshelf-layout-fix-qa/bookshelf-fix-1024.png`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/bookshelf-layout-fix-qa/bookshelf-fix-1024.png) |
| `png-1280` | screenshot | Fresh 1280×800 bookshelf capture | [`tmp/bookshelf-layout-fix-qa/bookshelf-fix-1280.png`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/bookshelf-layout-fix-qa/bookshelf-fix-1280.png) |
| `png-1366` | screenshot | Fresh 1366×768 bookshelf capture | [`tmp/bookshelf-layout-fix-qa/bookshelf-fix-1366.png`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/bookshelf-layout-fix-qa/bookshelf-fix-1366.png) |
| `cmd-results` | command-log | Read-only focused/full tests, lint, build, probe, and runtime-evidence limitation | [`bookshelf-natural-fidelity-gate-command-results.md`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/bookshelf-natural-fidelity-gate-command-results.md:1) |

## Overall verdict

Formula, bounded layout, desktop screenshot, focused regression, typecheck, and build evidence pass. The exact runtime center-range claim remains **FAIL / unverified** because no browser DOM measurement artifact exists; do not report that numeric claim as independently verified.
