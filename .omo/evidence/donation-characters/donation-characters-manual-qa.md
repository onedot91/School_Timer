# Manual QA — donation plaza character replacement

## Result

Product visual result: **PASS** for the inspected render and configured rotation. Overall QA evidence result: **REVISE** because the supplied `donation-plaza.png` is a JPEG/JFIF file despite its `.png` extension; regenerate a valid PNG capture before treating the visual pass as final.

No donation controls were clicked or invoked, and no live balances, bids, awards, or currency history were mutated.

## `manualQa`

### `surfaceEvidence`

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| DON-PLAZA-001 | Character integrates into plaza without green background, clipping, or distortion | Web screenshot: donation plaza | `view_image(.omo/evidence/donation-characters/donation-plaza.png)` | PASS (product) | A1, A3, A7 |
| DON-PLAZA-002 | Speech bubble remains present and readable/intact in the rendered character | Web screenshot: donation hotspot | `view_image(.omo/evidence/donation-characters/donation-plaza.png)`; `view_image(public/donation-character-{1,2,3,4}.png)` | PASS (bubble not clipped; small at capture size) | A1, A6, A7 |
| DON-ROT-001 | Four character images are configured for deterministic daily rotation | Source + CLI-shaped regression test | `sed -n '1,100p' src/lib/dailyDonationCharacter.ts`; `node --import tsx --test src/lib/dailyDonationCharacter.test.ts` | PASS | A2, A4, A5, A7 |

### `adversarialCases`

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| DON-ADV-001 | Transparent integration | Opaque/green background | Character PNGs expose transparency; plaza art remains visible behind/around the character | PASS | A1, A6, A7 |
| DON-ADV-002 | Bounds safety | Edge clipping | No limb or speech-bubble pixels are cut by the donation hotspot/plaza bounds | PASS | A1, A3, A7 |
| DON-ADV-003 | Asset fidelity | Aspect-ratio distortion | Character remains proportionally rendered with `object-fit: contain` | PASS | A1, A3, A6 |
| DON-ADV-004 | Copy legibility | Tiny/clipped speech bubble | Bubble is fully present and text is visible; no glyphs are cut | PASS (small but intact) | A1, A6, A7 |
| DON-ADV-005 | Rotation completeness | Missing fourth asset / unreachable source | Source array contains exactly `donation-character-1.png` through `-4.png`, and four date keys resolve to four sources | PASS | A2, A4, A5, A7 |
| DON-ADV-006 | Capture hygiene | Extension/signature mismatch | Supplied screenshot must be a valid PNG if named `.png` | REVISE — file is JPEG/JFIF (`FF D8 ... JFIF`) | A1, A7 |

## `artifactRefs`

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Supplied rendered donation plaza capture inspected directly | `.omo/evidence/donation-characters/donation-plaza.png` |
| A2 | source | Student plaza mounts the daily donation image inside the donation hotspot | `src/components/student/StudentPlaza.tsx:1` |
| A3 | source | Plaza/hotspot sizing and `object-fit: contain` styling | `src/index.css:14879` |
| A4 | source | Four-source deterministic daily rotation array | `src/lib/dailyDonationCharacter.ts:1` |
| A5 | test | Same-day stability and four-date/four-source rotation tests | `src/lib/dailyDonationCharacter.test.ts:1` |
| A6 | asset set | Four RGBA donation character assets | `public/donation-character-1.png`, `public/donation-character-2.png`, `public/donation-character-3.png`, `public/donation-character-4.png` |
| A7 | transcript | Commands, alpha inspection, test output, and capture-signature evidence | `.omo/evidence/donation-characters/donation-characters-evidence.txt` |

## Blocker / follow-up

Re-capture the plaza as a real PNG (or rename the existing JPEG to `.jpg` and reference that exact path) so capture signature matches extension. No product visual correction is indicated by the inspected pixels.
