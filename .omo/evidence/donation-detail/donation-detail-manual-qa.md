# Donation daily-character manual QA

Verdict: **PASS**

Read-only visual QA was run against the two requested fresh surfaces. No donation button,
navigation action, balance, bid, award, or currency state was mutated.

## `manualQa`

### `surfaceEvidence`

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| DON-VIS-01 | C-DON-01, C-DON-02 | Student store plaza / donation hotspot | Opened `.omo/evidence/donation-detail/donation-plaza-current.jpg` with `view_image`; read-only crop inspection; cross-checked `src/components/student/StudentPlaza.tsx` and `src/lib/dailyDonationCharacter.ts`. | PASS | `A1`, `A3`, `A5` |
| DON-VIS-02 | C-DON-01, C-DON-02 | Student store donation detail card | Opened `.omo/evidence/donation-detail/donation-detail-current.jpg` with `view_image`; read-only crop inspection; cross-checked `src/components/student/StudentDonationPage.tsx` and `src/lib/dailyDonationCharacter.ts`. | PASS | `A2`, `A3`, `A5` |
| DON-VIS-03 | C-DON-03 | Daily selection and asset/render integrity | `node -e "...dateKey 2026-08-16..."`; `sips -g hasAlpha -g format -g pixelWidth -g pixelHeight public/donation-character-3.png`; `npm run lint`; `node --import tsx --test src/lib/dailyDonationCharacter.test.ts`. | PASS | `A3`, `A4`, `A5` |

### `adversarialCases`

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| DON-ADV-01 | C-DON-03 | Green-background / alpha matte | Transparent asset must composite directly over plaza and white detail card with no green rectangle or halo. | PASS | `A1`, `A2`, `A3`, `A4` |
| DON-ADV-02 | C-DON-03 | Crop, aspect-ratio, or distortion | Character and speech bubble must remain fully visible and proportionally rendered in both surfaces. | PASS | `A1`, `A2`, `A3`, `A5` |
| DON-ADV-03 | C-DON-03 | CJK speech-bubble precision | `기부하고마` must remain legible as one intact phrase; no orphaned glyphs, tofu, or clipped baseline. | PASS | `A1`, `A2`, `A3` |
| DON-ADV-04 | C-DON-02 | Legacy asset regression | Donation detail must use the shared daily source, not `/donation-bear.png`. | PASS | `A2`, `A3`, `A5` |

### `artifactRefs`

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Fresh plaza capture with daily character in donation hotspot (938×703 JPEG). | `.omo/evidence/donation-detail/donation-plaza-current.jpg` |
| A2 | screenshot | Fresh donation detail capture with daily character and speech bubble (938×703 JPEG). | `.omo/evidence/donation-detail/donation-detail-current.jpg` |
| A3 | audit | Capture, date-selection, alpha, source-reference, and non-mutating check log. | `.omo/evidence/donation-detail/donation-detail-visual-audit.txt` |
| A4 | source-asset | Current selected daily asset; RGBA PNG with alpha (1243×1265). | `public/donation-character-3.png` |
| A5 | source | Shared daily selection/rendering implementation and tests. | `src/lib/dailyDonationCharacter.ts`, `src/components/student/StudentPlaza.tsx`, `src/components/student/StudentDonationPage.tsx`, `src/lib/dailyDonationCharacter.test.ts` |

## Evidence summary

For `2026-08-16`, the helper deterministically selects `donation-character-3.png`. Both
fresh captures show that same standing bear with the intact `기부하고마` bubble. The
asset has alpha, the rendered pixels show no green matte, and neither surface shows
clipping or distortion. The detail JSX uses the shared helper and contains no legacy
`donation-bear` reference.
