# Manual QA — profile arcade visual pass B

## Scope and verdict

- Surface: browser UI, StudentProfileGachaDialog, required viewport `1280×800`.
- Verdict: **REVISE** (high confidence).
- The requested settled captures are visually clean and CJK-safe, and reduced-motion result is static. The real motion capture exposes a transient but plainly visible overlap during the `saving → shuffling` handoff, so the full sequence is not a PASS.
- Capture freshness: source timestamps precede captures (`StudentProfileGachaDialog.tsx` 19:37:13; `index.css` 19:12:34; final captures 19:38–19:39, Aug 30 2026).

## `manualQa`

### `surfaceEvidence`

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | anticipation / confirm | Browser UI at 1280×800 | `node tmp/visual-qa/profile-gacha/capture-arcade-cdp.mjs` → CDP `Emulation.setDeviceMetricsOverride(1280,800)`, navigate app, click `무료로 뽑기`, capture `arcade-final-8/01-confirm.png` | PASS | A1 |
| S2 | save handoff | Browser UI at 1280×800 | Same command → click `뽑기 시작`, wait 250 ms, CDP `Page.captureScreenshot` to `arcade-final-8/02-saving-250.png` | PASS | A2 |
| S3 | fast horizontal reel | Browser UI at 1280×800 | Same command → wait for `shuffling`, wait 300 ms, CDP capture to `arcade-final-8/03-reel-fast-900.png` | PASS | A3 |
| S4 | staged deceleration / centered gate | Browser UI at 1280×800 | Same command → wait for `shuffling`, wait 1050 ms, CDP capture to `arcade-final-8/04-reel-decelerating-1850.png` | PASS | A4 |
| S5 | 3D reveal | Browser UI at 1280×800 | Same command → wait for `revealing`, wait 250 ms, CDP capture to `arcade-final-8/05-reveal-mid-2550.png` | PASS | A5 |
| S6 | stable result | Browser UI at 1280×800 | Same command → wait for `result`, wait 350 ms, CDP capture to `arcade-final-8/06-result-3100.png` | PASS | A6 |
| S7 | reduced-motion direct handoff | Browser UI at 1280×800 with `prefers-reduced-motion: reduce` | `node tmp/visual-qa/profile-gacha/capture-arcade-reduced-cdp.mjs` → CDP emulated media `reduce`, click `뽑기 시작`, wait for `revealing`/`result`, capture `arcade-reduced-harness-final-4/02-reduced-result.png` | PASS | A7 |

### `adversarialCases`

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV1 | full motion sequence, no overlap | animation transition overlap | Stage handoff must not expose old saving content underneath the reel | **FAIL / REVISE** | A8, A9, A10 |
| ADV2 | CJK precision | Korean orphan/split/garbled glyphs | Headings and body copy remain natural Korean phrases with no orphan syllables, clipping, tofu, or baseline loss | PASS | A1–A7 |
| ADV3 | viewport integrity | clipping / unintended scroll / overlap | Modal and content stay inside 1280×800; only intentional reel edge masking occurs; no page scroll | PASS | A1–A7 |
| ADV4 | reduced motion | travel / rotation leakage | Reduced path omits horizontal reel travel and 3D rotation; result settles directly | PASS | A7, A11 |

## `artifactRefs`

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Confirm/anticipation, 1280×800 | `tmp/visual-qa/profile-gacha/arcade-final-8/01-confirm.png` |
| A2 | screenshot | Saving state at 250 ms, 1280×800 | `tmp/visual-qa/profile-gacha/arcade-final-8/02-saving-250.png` |
| A3 | screenshot | Fast reel at 900 ms, 1280×800 | `tmp/visual-qa/profile-gacha/arcade-final-8/03-reel-fast-900.png` |
| A4 | screenshot | Decelerating reel at 1850 ms, 1280×800 | `tmp/visual-qa/profile-gacha/arcade-final-8/04-reel-decelerating-1850.png` |
| A5 | screenshot | Mid reveal at 2550 ms, 1280×800 | `tmp/visual-qa/profile-gacha/arcade-final-8/05-reveal-mid-2550.png` |
| A6 | screenshot | Stable result at 3100 ms, 1280×800 | `tmp/visual-qa/profile-gacha/arcade-final-8/06-result-3100.png` |
| A7 | screenshot | Reduced-motion stable result, 1280×800 | `tmp/visual-qa/profile-gacha/arcade-reduced-harness-final-4/02-reduced-result.png` |
| A8 | animation capture | Full real motion sequence | `tmp/visual-qa/profile-gacha/arcade-final-8/profile-gacha-arcade-demo.gif` |
| A9 | motion frame | Saving→reel overlap at transition frame | `tmp/visual-qa/profile-gacha/arcade-final-8/frame-0028.jpg` |
| A10 | motion frame | Overlap persists during transition | `tmp/visual-qa/profile-gacha/arcade-final-8/frame-0030.jpg` |
| A11 | motion frame | Reduced-motion mid handoff (static centered card; no travel/rotation) | `tmp/visual-qa/profile-gacha/arcade-reduced-harness-final-4/01-reduced-mid-100.png` |

## Evidence trace / finding

- **[product] [high] `frame-0028`–`frame-0035`, screen center/lower reel copy region:** During `saving → shuffling`, the prior `카드를 준비하고 있어요`/spinner/card remains visible while the reel and `어떤 친구가 나올까요?` enter. `frame-0028` and `frame-0030` show duplicated stacked Korean headings and card imagery; `frame-0032`/`0035` still show the old heading underneath the new reel copy. The source uses `AnimatePresence mode={reduceMotion ? 'wait' : 'popLayout'}` with `key={stageLayoutKey}` (`StudentProfileGachaDialog.tsx:280–290`) and stage keys change from `saving` to `arcade`, allowing both layout trees to render during exit/enter. Concrete fix: make the handoff wait for the saving stage exit (`mode="wait"` for this stage transition or a dedicated fixed-height crossfade that hides the outgoing content before mounting reel), then recapture the full motion sequence.

## What is good

- Confirm, saving, reel-fast, deceleration, reveal, and result screenshots are centered in the modal with no clipping, unintended scroll, or illegible CJK. Intentional reel edge masking is contained by the rounded window.
- `word-break: keep-all` and balanced text styling in `src/index.css:23190–23204` keep Korean phrases whole at the required viewport; no orphan particles/endings or tofu were observed.
- Reel cards visibly travel horizontally with a centered gate and staged deceleration (`StudentProfileGachaDialog.tsx:333–367`), then the selected card flips in 3D (`:391–428`) and lands as a stable result (`:443–469`).
- Reduced-motion capture shows a centered static card/result; source branches omit travel/rotation transforms in reduced mode (`StudentProfileGachaDialog.tsx:394–428`), consistent with the requirement.
