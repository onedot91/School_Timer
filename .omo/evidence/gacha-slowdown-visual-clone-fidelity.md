# Gacha slowdown final visual fidelity review

- Goal: verify the random-profile reel's gradual slowdown, connected question-card → penguin reveal, CJK precision, and complete `1280×800` motion evidence.
- Review type: final read-only visual fidelity / motion / CJK gate.
- Verdict: **REVISE**
- Recommendation: **REQUEST_CHANGES**
- Confidence: **HIGH**

## Evidence inspected

- Static-state packet directly opened at original resolution: all five PNGs in `tmp/visual-qa/profile-gacha/slowdown-final-4/` (`01-confirm`, `02-fast`, `03-slowdown`, `04-locking`, `06-result-settled`).
- Initial 70-frame packet directly opened at the required samples and neighbours: `0000/0001`, `0009–0011`, `0016–0021`, `0029–0031`, `0039–0041`, `0049–0051`, `0054–0056`, `0059–0061`, `0064–0066`, and `0068–0069`.
- Replacement uninterrupted motion packet directly opened: `tmp/visual-qa/profile-gacha/slowdown-motion-final/frame-0000.jpg` through selected full-coverage samples `0010`, `0013–0015`, `0017`, `0020`, `0030`, `0040`, `0050`, `0055`, `0060–0075`. In particular, the lock/flip/result run `0064`, `0068`, `0070–0075` was viewed at original resolution.
- Implementation read: `src/components/student/StudentProfileGachaDialog.tsx:37-67, 234-251, 303-318, 347-494` and `src/index.css:23032-23465`.
- Integrity/freshness: every checked PNG is RGB `1280×800`; every JPEG is a three-component baseline `1280×800`. The replacement 76-frame sequence and all static-state PNGs postdate `StudentProfileGachaDialog.tsx` (21:31:42) and `src/index.css` (20:20:31).

## Evidence trace

| Area | Verified observation |
|---|---|
| Static states | Confirm, fast reel, slowdown, lock, and settled penguin views are centered, fully contained, token-styled live UI; no raster/screenshot substitute is used. |
| CJK and layout | The previous `frame-0020` collision is absent in fresh `slowdown-final-4` frames `0019–0021`; inspected Korean copy has no overlap, clipping, tofu, or unnatural wrap. No modal overflow or scroll is visible at `1280×800`. |
| Reel motion | Source checkpoints `-65% → -69.5% → -71.5% → -72.2% → -72.5% → -72.5%` at `0.65 → 0.77 → 0.86 → 0.92 → 0.95 → 1` (`StudentProfileGachaDialog.tsx:53-67`) yield shrinking terminal travel and the promised 160 ms final hold. The sampled reel frames visibly agree. |
| Lock and reveal | `slowdown-motion-final` frames `0064/0068` lock the question card in the central gate; `0070` retains it with reveal copy, `0071–0072` show its 3D edge turn, and `0073–0075` turn continuously into the centered penguin then the settled result/action. Source maintains `stageLayoutKey === 'arcade'` and the same `student-profile-gacha-winning-frame` across shuffle/reveal/result (`StudentProfileGachaDialog.tsx:134-136, 407-463`), so this is not a scene teleport. |
| Capture defect | `slowdown-motion-final/frame-0013.jpg` and `frame-0015.jpg` both show the saving card, loader, and copy. The intervening `frame-0014.jpg` is a valid `1280×800` JPEG but contains only the empty modal shell—no stage content at all. |

## Findings

### CRITICAL

None. The rendered surface is a live React/Motion component tree using real text, controls, and `<img>` elements. The CSS consumes the existing `--apple-*`, `--failure-*`, and `--student-*` token system rather than substituting a screenshot.

### HIGH

- **[evidence] Defective blank frame blocks the complete motion proof.** `tmp/visual-qa/profile-gacha/slowdown-motion-final/frame-0014.jpg` is an empty modal between fully populated saving frames `0013` and `0015`. It is a valid image, but it fails the stated no-partial/no-defective-frame requirement and cannot prove an uninterrupted handoff into the reel. The static and source evidence make this more consistent with a capture/compositor fault than a deliberate state, but it must be resolved by producing a clean uninterrupted capture (or, if reproducible, treating it as a product issue). No approval can rely on a sequence containing this blank frame.

### MEDIUM

None.

### LOW

None.

## What is good — do not regress

- The longer reel visibly slows, locks with a meaningful gate pulse, and has an exact final transform hold.
- Early reel cards in the populated reel samples are real, fully rendered animal images—not blank placeholders.
- The question card flips through a visible edge state into the same-position penguin, then the success label/copy/action enter cleanly.
- At rest and during the inspected animation frames, CJK rendering, clipping, modal bounds, and scroll behavior are clean.

## Blocking

- **[evidence]** Replace or explain `slowdown-motion-final/frame-0014.jpg` with a fresh sequence that contains no blank/partial frame. Re-run the final visual gate against that capture. The prior missing flip-evidence blocker is resolved by frames `0070–0075`.
