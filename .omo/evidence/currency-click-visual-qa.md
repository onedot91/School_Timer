# Currency button visual QA

Scope: read-only inspection of the latest isolated screenshots written to `/private/tmp/school-timer-currency-qa-*.png` and the `TimerPage.tsx` diff. No currency controls were clicked by this reviewer.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| CUR-V-1024 | smallest supported desktop width remains usable | local TimerPage currency panel | `view_image({path: "/private/tmp/school-timer-currency-qa-1024-visual.png"})` | PASS | `img-1024`, `src-timer` |
| CUR-V-1280 | target Chromebook/desktop width remains usable | local TimerPage currency panel | `view_image({path: "/private/tmp/school-timer-currency-qa-1280-visual.png"})` | PASS | `img-1280`, `src-timer` |
| CUR-V-1366 | wide desktop layout has no clipping | local TimerPage currency panel | `view_image({path: "/private/tmp/school-timer-currency-qa-1366-visual.png"})` | REVISE | `img-1366`, `src-timer` |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| CUR-A-BOUNDARY | 1024px width | smallest supported viewport | Header, tabs, student input, balance, and −/+ controls remain inside the panel | PASS | `img-1024` |
| CUR-A-CJK | all target widths | Korean copy legibility and text overlap | `화폐`, `개인`, `모둠`, `전체`, and the amount summary remain readable without overlap | PASS at 1024/1280; REVISE at 1366 because the right side is clipped | `img-1024`, `img-1280`, `img-1366` |
| CUR-A-ACTION | immediate feedback styling | pressed-state visibility | The changed controls expose `active:scale` and active background feedback, while the balance summary is visibly updated | PASS visually in 1024/1280 (`105 +5` and focused `+`); static screenshots cannot prove event latency | `img-1024`, `img-1280`, `src-timer` |

## artifactRefs

| id | kind | description | path |
| --- | --- | --- | --- |
| img-1024 | screenshot | converted valid PNG of the latest 1024 capture; panel and controls fully visible | `/private/tmp/school-timer-currency-qa-1024-visual.png` |
| img-1280 | screenshot | converted valid PNG of the latest 1280 capture; panel and controls fully visible | `/private/tmp/school-timer-currency-qa-1280-visual.png` |
| img-1366 | screenshot | converted valid PNG of the latest 1366 capture; panel right edge is clipped in the supplied artifact | `/private/tmp/school-timer-currency-qa-1366-visual.png` |
| src-timer | source | `TimerPage.tsx` immediate commit and pressed-state diff | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:6334` |

## Verdict

REVISE / re-capture and re-check the 1366 scenario. The 1024 and 1280 artifacts pass the visual criteria, but the latest 1366 artifact is only 860px wide and visibly truncates the right side of the currency panel. The source diff does show immediate commit via `flushSync` and pressed-state classes; runtime latency is outside this read-only visual review.
