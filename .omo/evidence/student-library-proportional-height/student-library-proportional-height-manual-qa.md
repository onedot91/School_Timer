# Student library proportional-height manual QA

- Verdict: **PASS**
- Surface: web UI — student `library` page at 1280×720
- Scope: verify page-proportional book height, summed cm label, readability, overflow, and accessibility from the supplied capture and current source.
- Attempt directory: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-library-proportional-height` (fallback used because `omo ulw-loop status --json` was unavailable: `omo: command not found`).

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| SC-01 | C1 proportional height | Student Library page / book stack | Inspect `library-1280x720.jpg` with `view_image(path=..., detail=original)`; run `node --import tsx -e "...getBookHeightCm(30)...getBookHeightCm(121)..."` | PASS | A1, A2, A3 |
| SC-02 | C2 top cm label | Student Library page / stack header | Inspect supplied screenshot; inspect `StudentLibraryPage.tsx` lines 23–48 and `studentLife.ts` lines 118–124 | PASS | A1, A3, A4 |
| SC-03 | C3 reference structure | Student Library page vs structure reference | Inspect supplied reference and actual images with `view_image(..., detail=original)` | PASS | A1, A5 |
| SC-04 | C4 readability and overflow | 1280×720 rendered browser capture | Inspect supplied 1280×720 JPEG; verify `file`/`sips` dimensions; inspect CSS lines 12138–12192 | PASS | A1, A6, A7 |
| SC-05 | C5 accessibility | Form and book semantics in Student Library source | Inspect `StudentLibraryPage.tsx` lines 29–62 and `DESIGN.md` lines 120–126, 161–175 | PASS | A3, A7 |
| SC-06 | regression checks | Student life calculation path | `npm test` and `npm run lint` from repository root | PASS | A8 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-01 | C1 | unequal page counts (30 vs 121) | The 121-page book is visibly thicker and its computed height follows the same scale as the 30-page book. | PASS | A1, A2, A3 |
| ADV-02 | C4/C5 | Korean title and page-count readability | Title is constrained by `maxLength=50`, long text is ellipsized without wrapping, and page count remains a separate visible span/accessible label. | PASS | A1, A3, A7 |
| ADV-03 | C2 | empty stack | No misleading height label is rendered; the empty-state prompt is rendered instead. | PASS | A3 |
| ADV-04 | scope | live balance/currency mutation | Not applicable: this change is a presentation/calculation path for books and does not trigger balance, bid, award, or currency-history mutation. | not_applicable | A3, A4 |

## Findings

- No `[product]` defect was found in the supplied 1280×720 scenario. The screenshot shows readable titles/page counts, the 121-page spine is thicker than the 30-page spine, the top label reads `약 0.75cm`, and no clipping or horizontal overflow is visible.
- `[evidence][low]` A fresh browser action log and the two independent visual-QA oracle passes could not be produced because no browser automation package/binary or `multi_agent` tool was available in this session. This is an evidence-process limitation, not a rendered-product defect; the supplied capture was checked as a valid, current JPEG and source/read-only checks were rerun.

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Supplied actual student library capture, 1280×720 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-library-proportional-height/library-1280x720.jpg` |
| A2 | reference-image | User-provided structure reference; not treated as a pixel target | `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-a68924e0-5cb0-44d7-be7f-46ae4dcf9350.png` |
| A3 | source | Library render and accessibility labels | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx` |
| A4 | source | Page-height and stack-height calculation | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts` |
| A5 | documentation | Student library design contract and reference intent | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md` |
| A6 | source | Library layout, book stack, typography, responsive CSS | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css` |
| A7 | metadata | JPEG signature and 1280×720 dimensions verified with `file` and `sips` | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-library-proportional-height/library-1280x720.jpg` |
| A8 | command-result | Read-only test, lint, calculation, and capture-validation results | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-library-proportional-height/student-library-proportional-height-execution.txt` |
