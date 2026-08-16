# Goma skin catalog manual QA

Verdict: **PASS** for the requested read-only surface scope.

This pass verifies the supplied actual student overview/picker captures, the current catalog image files, native alpha metadata, the flattened compositing contact sheet, and the source `<img>` render path. Live student `#2` data was not mutated; the picker showing only `기본 고마 / 사용 중` is expected because that account owns no added skin. A populated owned-skin browser state is intentionally not claimed by this matrix.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| SV-01 | student overview layout and selected default character | Browser UI, student overview | `file .omo/evidence/goma-skin-catalog/student-overview-final.png`; `sips -g pixelWidth -g pixelHeight -g hasAlpha .../student-overview-final.png`; `view_image(path=.../student-overview-final.png)` | PASS | A1, A4 |
| SV-02 | student #2 ownership-gated skin picker | Browser UI, skin-picker dialog | `file .omo/evidence/goma-skin-catalog/student-skin-picker-final.png`; `sips -g pixelWidth -g pixelHeight -g hasAlpha .../student-skin-picker-final.png`; `view_image(path=.../student-skin-picker-final.png)` | PASS | A2, A5 |
| SV-03 | added skin native alpha and visual compositing | PNG asset set + flattened visual composite | `for f in public/goma-skins/*.png; do file "$f"; sips -g hasAlpha -g pixelWidth -g pixelHeight "$f"; done`; `view_image(path=.../rgba-skin-composite.png)` | PASS | A3, A6 |
| SV-04 | standard image render path and catalog path integrity | Source render path | `nl -ba src/components/student/StudentOverviewPage.tsx \| sed -n '204,227p'`; `nl -ba src/components/student/StudentPetStage.tsx \| sed -n '209,213p'`; `node --import tsx -e "import {STUDENT_CHARACTER_PRIZES} ...; ..."` | PASS | A4, A5, A7 |
| SV-05 | source/type and catalog regression checks | CLI/data-shaped verification | `npm run lint`; `node --test --import tsx src/lib/studentEconomy.test.ts`; `git diff --check` | PASS | A8 |

Observed visual result: the overview stage, character, and three destination cards stay inside the rounded frame at 1075×672. The picker backdrop, dialog, close control, heading, default card, and Korean labels are fully visible without clipping or unnatural line breaks. The composite shows nurse, police, glass, wood, piano, and fire assets on a light background with clean silhouettes and no black/opaque matte; the faint pale edge on the glass character is consistent with its translucent/glass treatment.

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| AD-01 | ownership boundary | unowned skin injection | Picker renders `DEFAULT_STUDENT_CHARACTER` plus only IDs present in `ownedCharacterIds`; an unowned custom skin must not become selectable. | PASS (source path + live empty-owner capture) | A2, A4, A5 |
| AD-02 | native alpha composition | transparent PNG matte/black-fill regression | Catalog files retain RGBA alpha and compositing must not introduce black or opaque rectangular fills. | PASS | A3, A6 |
| AD-03 | CJK precision and modal bounds | Korean text clipping/orphaning | `스킨 고르기`, `함께할 고마를 골라 주세요`, `기본 고마`, and `사용 중` remain legible and inside controls. | PASS | A2, A5 |
| AD-04 | path completeness | missing or duplicate catalog asset path | All catalog entries resolve to existing unique files. | PASS | A7 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Student overview actual PNG, 1075×672 RGB, non-empty (950985 bytes) | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-skin-catalog/student-overview-final.png` |
| A2 | screenshot | Student skin-picker actual PNG, 1075×672 RGB, non-empty (618812 bytes) | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-skin-catalog/student-skin-picker-final.png` |
| A3 | screenshot | Flattened visual composite of added skins, 900×600 RGB, non-empty (391055 bytes) | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-skin-catalog/rgba-skin-composite.png` |
| A4 | source | Student stage uses a normal `<img>` for `activeCharacter.imageSrc` and default fallback | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx:209` |
| A5 | source | Picker filters ownership and renders `character.imageSrc` through a normal `<img>` | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx:89` |
| A6 | asset set | 56 catalog PNGs checked as valid 1254×1254 8-bit RGBA files; legacy 15 are valid 720×720 RGBA files | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/public/goma-skins/` |
| A7 | parsed check | Catalog count 56, unique image paths 56, missing files 0 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:29` |
| A8 | CLI output | `npm run lint` exit 0; targeted `studentEconomy.test.ts` 24/24 passed; `git diff --check` clean | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/` |

No product files or live student balances, bids, awards, or currency state were changed.
