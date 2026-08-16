# Goma catalog manual QA

## Verdict

**PASS** — fresh 1075x672 JPEG captures render the catalog cards without visible CJK clipping/overlap. The `102종` badge is visible, and the requested labels render exactly as `사또 고마`, `수묵 고마`, and `수염 고마`. The source map preserves the expected IDs and image paths.

## Surface evidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| GOMA-CATALOG-01 | C1, C2 | Teacher settings > 상점 > 고마 스킨 도감, top viewport | Open `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-catalog-102/catalog-visible-top.jpg` with image viewer; inspect the rendered catalog header and visible cards | PASS | A1 |
| GOMA-CATALOG-02 | C1, C2, C4 | Teacher settings > 상점 > 고마 스킨 도감, lower viewport | Open `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-catalog-102/catalog-visible-bottom.jpg` with image viewer; inspect visible lower cards and card backgrounds | PASS | A2 |
| GOMA-CATALOG-03 | C1, C2, C3, C4 | Teacher settings > 상점 > 고마 스킨 도감, renamed-label viewport | Open `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-catalog-102/catalog-renamed.jpg` with image viewer; inspect the cards containing the three requested labels | PASS | A3 |
| GOMA-CATALOG-04 | C5 | `STUDENT_CHARACTER_PRIZES` source map | Read `src/lib/studentEconomy.ts` lines 109–112 and verify the three exact name/ID/imageSrc tuples; verify the three referenced PNGs are non-empty files | PASS | A4, A5 |

## Evidence trace

- A1, A2, and A3 are valid JPEG/JFIF captures, each `1075x672`; all opened successfully. No black/partial compositor region was observed.
- The catalog header shows `102종` at the upper-right in the top and renamed captures; the lower capture retains the badge in the visible header area.
- In A3, the requested cards are visible in a consistent three-column grid: `사또 고마` is the middle card of the second visible row, `수묵 고마` is the left card of the next row, and `수염 고마` is the middle card of that row.
- Each requested label is a complete one-line Korean phrase. No glyph is dropped, no syllable is orphaned, and no text overlaps its image or card boundary.
- The requested character artwork remains contained within its light catalog card backgrounds. No visible green-screen rectangle, stretched image, or card-boundary crop appears in the rendered captures. The partially visible rows at the bottom are viewport/scroll-container cropping only; their visible text and artwork are not clipped internally.
- Source entries are exactly:
  - `character-80` → `사또 고마` → `/goma-skins/hatto-goma.png`
  - `character-82` → `수묵 고마` → `/goma-skins/ink-goma.png`
  - `character-83` → `수염 고마` → `/goma-skins/bearded-goma.png`
- The three PNG paths exist and are non-empty. `npm run lint` passed, and `node --test --experimental-strip-types src/lib/studentEconomy.test.ts` passed all 25 tests, including the 46-skin catalog registration test.
- Direct read-only evaluation of `STUDENT_CHARACTER_PRIZES` reports `count: 102` and the three exact tuples above.

## Adversarial cases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| GOMA-CATALOG-ADV-01 | C3 | CJK clipping/orphaning/overlap | Each requested Korean label remains a single readable phrase with no clipped baseline, orphaned syllable, or overlap | PASS | A3 |
| GOMA-CATALOG-ADV-02 | C4 | Image/background composition | New artwork stays inside the card, keeps its intended proportions, and does not expose a green-screen/opaque rectangle | PASS | A3, A4 |
| GOMA-CATALOG-ADV-03 | C2 | Count/badge mismatch | Catalog count badge must read exactly `102종` and remain visible in the rendered header | PASS | A1, A2, A3 |
| GOMA-CATALOG-ADV-04 | C5 | Label-to-ID/path mismatch | Exact labels must map to the expected stable IDs and image paths; missing asset paths must fail | PASS | A4, A5 |
| GOMA-CATALOG-ADV-05 | C1 | Defective or stale evidence capture | Each supplied capture must be a readable JPEG with the requested 1075x672 dimensions | PASS | A1, A2, A3 |

## Artifact references

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Fresh top catalog JPEG, 1075x672 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-catalog-102/catalog-visible-top.jpg` |
| A2 | screenshot | Fresh lower catalog JPEG, 1075x672 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-catalog-102/catalog-visible-bottom.jpg` |
| A3 | screenshot | Fresh renamed-label catalog JPEG, 1075x672 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-catalog-102/catalog-renamed.jpg` |
| A4 | source | Character catalog map and rendering source | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:109` |
| A5 | asset-check | Referenced character PNG assets (`hatto-goma.png`, `ink-goma.png`, `bearded-goma.png`) verified present and non-empty | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/public/goma-skins/` |

## Blockers

None.
