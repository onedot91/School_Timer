# Library shelf-open integrity review

## Recommendation

**PASS**

No product/evidence blocker was found for the requested narrow interaction change.

## Product intent reviewed

- Standing nearest an occupied book at any shelf must still present `책장 열기`.
- Every supported activation (`E`, `Enter`, Korean-layout `ㄷ`, and cue click) must open the full shelf, never jump directly to book details.
- Book details must remain available only after selecting an occupied slot inside the opened shelf.
- Closing with `Escape` must return focus to the canvas.

## Source review

Checked: `src/components/student/library/CanvasLibraryGame.tsx`

- Current SHA-256: `7864220e9a6f11f67f043386446759a59fa6d0de2b28b54b01152af2c0ee204a`.
- The hash matches both `sourceStart` and `sourceEnd` in `after.json`, so the reviewed source is the source exercised by the capture packet.
- `interact` handles `shelf` and `placed-book` through the same unconditional shelf modal path: `openModal({ kind: 'slots', shelfId: target.shelfId })`.
- `nearbyActionLabel` handles `shelf` and `placed-book` through the same unconditional `가까운 곳 살펴보기: 책장 열기` label.
- Pointer activation accepts both target kinds and then routes through the same `interact` function.
- The only `setModal({ kind: 'details', ... })` path in the component is inside `chooseSlot`, after an occupied slot is selected. No remaining direct nearby placed-book-to-details path was found.

## Evidence reviewed

Checked artifacts:

- `.omo/evidence/library-shelf-open/before.json`
- `.omo/evidence/library-shelf-open/after.json`
- `.omo/evidence/library-shelf-open/fixture.tsx`
- `.omo/evidence/library-shelf-open/qa.mjs`
- All 24 `after-shelf-*.png` captures (four shelves × cue, opened, selected-book, Enter, Korean-layout key, click)

Observed proof:

- Baseline records all four occupied-book edge targets as `책 정보` with `openedShelf: false`.
- After packet records all four as `책장 열기` with `openedShelf: true`.
- All 24 captures are 1280×800. The cue is visible and says `책장 열기`; each activation capture shows the full correct shelf; each selected-book capture shows details only after shelf selection.
- The QA driver asserts the cue label, shelf-open control, zero page errors, and canvas focus after each `Escape` cycle. `after.json` reports zero errors and stable source hashes.
- Fixture uses the real `CanvasLibraryGame` and full room, changes only spawn to each occupied slot interaction point, supplies one controlled synthetic book, and performs no backend write.

## Reproduced gates

- `npm run lint`: PASS (`tsc --noEmit`)
- `npm test`: PASS (669/669)
- `npm run build`: PASS (Vite production build)

## Programming / remove-ai-slops pass

- The change merges two existing target variants at the two behavior seams; it adds no helper, parser, normalization layer, dependency, defensive branch, logging, dead code, or implementation-mirroring/deletion-only test.
- The browser packet exercises observable behavior through the real component rather than asserting source text.
- The component is already oversized (776 pure LOC), but this is inherited architecture and not a failure of the stated shelf interaction criterion; under the narrow no-refactor brief it is a non-blocking note.
- No scope drift or maintenance burden attributable to this two-branch change was found.

## Blockers

None.

