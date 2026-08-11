# Manual QA: student donation daily character

Verdict: **PASS**

Scope: read-only independent visual QA of the supplied correctly typed screenshots, three transparent character assets, live local student plaza, `StudentPlaza.tsx`, `index.css`, and the requested deterministic test evidence. Dates were not time-traveled in the browser; the deterministic source and passing three-date test are accepted as the behavioral proof per request.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| V-1024 | 1024 screenshot; larger character in bottom-right lot; no detached green `기부` copy | Supplied screenshot and live browser at 1024x768 | `view_image` on `donation-visible-1024.jpg`; Browser viewport `1024x768` -> reload `http://localhost:3000/#student-store` -> DOM snapshot and screenshot | PASS | A1, A3, A5 |
| V-1280 | 1280 screenshot; larger character in bottom-right lot; no detached green `기부` copy | Supplied screenshot and live browser at 1280x900 | `view_image` on `donation-visible-1280.jpg`; Browser viewport `1280x900` -> reload `http://localhost:3000/#student-store` -> DOM snapshot and screenshot | PASS | A2, A4, A5 |
| V-ASSETS | all three requested assets are transparent and visually complete | Local PNG assets | `view_image` on `public/donation-character-1.png`, `-2.png`, `-3.png`; PNG IHDR parse via Node read-only command | PASS | A6, A7 |
| V-SOURCE | one daily source, one character for the rendered day, no detached copy, lower-right placement | React/CSS source | Read `src/components/student/StudentPlaza.tsx` and `src/index.css`; inspected lines 18, 34-41, 14682-14693 | PASS | A5, A7 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-DATE-STABILITY | same character for whole day | same-date repeat/reload | Same date key returns the same one of three paths, and reload does not change the observed source | PASS | A5, A7 |
| ADV-DATE-CYCLE | daily one-of-three selection | three consecutive date keys | Three consecutive tested dates cover all three character paths | PASS | A7 |
| ADV-COPY | no detached green `기부` copy | DOM/text and screenshot inspection | Donation hotspot has no text child; only the transparent character image is rendered, with its own speech bubble | PASS | A1, A2, A3, A4, A5 |
| ADV-RESPONSIVE | larger character in bottom-right lot | 1024x768 and 1280x900 viewport comparison | Character remains visibly large and inside the lower-right lot at both requested sizes | PASS | A1, A2, A3, A4, A5 |
| ADV-ALPHA | transparent assets | alpha-channel inspection | All three PNGs retain alpha and do not require opaque background fills | PASS | A6 |
| ADV-RELOAD | same source before/after browser reload | browser reload stability | `/donation-character-3.png` is observed before and after reload | PASS | A5 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Supplied 1024x768 correctly typed visual capture | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-donation-daily-character/donation-visible-1024.jpg` |
| A2 | screenshot | Supplied 1280x900 correctly typed visual capture | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-donation-daily-character/donation-visible-1280.jpg` |
| A3 | screenshot | Fresh live-browser 1024x768 capture, JPEG signature verified | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-donation-daily-character/browser-donation-1024.jpg` |
| A4 | screenshot | Fresh live-browser 1280x900 capture, JPEG signature verified | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-donation-daily-character/browser-donation-1280.jpg` |
| A5 | browser-log | Live navigation, DOM, geometry, text, source, and reload observations | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-donation-daily-character/browser-action-log.md` |
| A6 | asset-evidence | Three PNG dimensions, alpha-channel parse, and visual inspection note | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-donation-daily-character/asset-and-test-evidence.md` |
| A7 | source-and-test | Source line references, focused test result, and lint result | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-donation-daily-character/asset-and-test-evidence.md` |
