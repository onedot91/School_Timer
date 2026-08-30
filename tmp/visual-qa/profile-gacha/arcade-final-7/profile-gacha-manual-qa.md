# Profile gacha arcade manual QA

독립 read-only QA. 실제 사용자 잔액·프로필·구매 상태를 변경하지 않았다.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| ARC-01 | C1 confirm surface at 1280x800; no clipping/overlap/scroll | Browser-rendered web modal, confirm state | `view_image("arcade-final-7/01-confirm.png")` | PASS | A01 |
| ARC-02 | C2 anticipation/save state | Browser-rendered web modal, saving state | `view_image("arcade-final-7/02-saving-250.png")` | PASS | A02 |
| ARC-03 | C3 fast horizontal reel and visible center gate | Browser-rendered web modal, fast reel at 900ms | `view_image("arcade-final-7/03-reel-fast-900.png")` | PASS | A03 |
| ARC-04 | C4 staged deceleration | Browser-rendered web modal, decelerating reel at 1850ms | `view_image("arcade-final-7/04-reel-decelerating-1850.png")` | PASS | A04 |
| ARC-05 | C5 center-gate / 3D reveal mid-transition | Browser-rendered web modal, reveal at 2550ms | `view_image("arcade-final-7/05-reveal-mid-2550.png")` | PASS | A05 |
| ARC-06 | C6 stable result state and Korean copy | Browser-rendered web modal, settled result at 3100ms | `view_image("arcade-final-7/06-result-3100.png")` | PASS | A06 |
| ARC-07 | C2-C6 complete motion sequence | Browser-rendered web modal animation | `PIL.Image.open("arcade-final-7/profile-gacha-arcade-demo.gif"); iterate all 147 frames; view sampled frames 000, 020, 040, 060, 080, 100, 120, 140, 146` | PASS | A07 |
| ARC-08 | C7 prefers-reduced-motion result remains usable/stable | Browser-rendered web modal, reduced-motion harness result | `view_image("arcade-reduced-harness-final-3/02-reduced-result.png")` | PASS | A08 |
| ARC-09 | C7 motion/a11y implementation path | Source component and CSS, read-only | `nl -ba src/components/student/StudentProfileGachaDialog.tsx; nl -ba src/index.css; npm run lint` | PASS | A09, A10 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-01 | C1 | exact viewport / capture integrity | Every required PNG/GIF frame surface is 1280x800, with valid image signatures and fully composited content | PASS | A01-A08 |
| ADV-02 | C1 | clipping, overlap, unintended scroll | Dialog, cards, Korean headings, actions, and reel remain within the viewport; no product scroll or overlap is visible | PASS | A01-A06, A08 |
| ADV-03 | C2-C5 | motion existence / staged timing | Reel changes between fast and decelerating samples, then transitions to a centered winning card and reveal; settled result is stable | PASS | A03-A07 |
| ADV-04 | C3-C5 | center-gate alignment | Selection/Winning gate stays centered over the reel window; reveal card is not clipped by the window | PASS | A03-A05, A07 |
| ADV-05 | C7 | reduced-motion path | Reduced harness reaches a readable settled result without the normal reel sequence; result controls remain visible | PASS | A08-A10 |
| ADV-06 | C7 | CJK text integrity | Korean labels/headings remain legible, natural, and unbroken into orphan syllables; no tofu or baseline clipping | PASS | A01-A06, A08 |
| ADV-07 | C7 | focus/modal semantics by source trace | Dialog has modal labeling/busy state, focus moves to start/processing/result targets, Escape/Tab handling is provided, and outside siblings are inerted | PASS | A09, A10 |
| ADV-08 | C2-C6 | capture-tool contamination | Tiny black bottom-center pill is ignored as documented capture-tool contamination; no other unexplained product artifact is used for verdict | PASS | A01-A07 |
| ADV-09 | C8 | live-data mutation safety | The real app data path is not invoked; the harness uses a disposable fake `onPurchase` result and therefore does not alter balances, bids, awards, or currency history | PASS | A01-A07, A11 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A01 | screenshot | Confirm state, 1280x800 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-final-7/01-confirm.png` |
| A02 | screenshot | Saving state, 1280x800 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-final-7/02-saving-250.png` |
| A03 | screenshot | Fast reel, 900ms sample, 1280x800 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-final-7/03-reel-fast-900.png` |
| A04 | screenshot | Decelerating reel, 1850ms sample, 1280x800 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-final-7/04-reel-decelerating-1850.png` |
| A05 | screenshot | Mid reveal, 2550ms sample, 1280x800 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-final-7/05-reveal-mid-2550.png` |
| A06 | screenshot | Settled result, 3100ms sample, 1280x800 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-final-7/06-result-3100.png` |
| A07 | animation | Normal arcade GIF, 147 frames at 30ms, 1280x800 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-final-7/profile-gacha-arcade-demo.gif` |
| A08 | screenshot | Reduced-motion settled result, 1280x800 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-reduced-harness-final-3/02-reduced-result.png` |
| A09 | source | Motion stages, timers, reduced-motion and dialog a11y paths | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentProfileGachaDialog.tsx` |
| A10 | source/test-output | Gacha CSS, forced-colors/reduced-transparency paths; `npm run lint` passed | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css` |
| A11 | harness/source | Disposable visual harness with fake `onPurchase` and fixed 1280x800 CDP capture | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/profile-gacha/arcade-harness.tsx` |

## Verdict

PASS. All requested normal and reduced-motion artifacts were directly inspected at 1280x800; the GIF was also iterated frame-by-frame and sampled through save, reel, deceleration, reveal, and stable result. No clipping, overlap, CJK corruption, unintended scroll, or unexplained product artifact was observed; the bottom-center black pill is capture-tool contamination per the test brief.
