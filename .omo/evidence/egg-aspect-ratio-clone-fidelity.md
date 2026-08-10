# Egg aspect-ratio clone fidelity review

- Goal: verify the student-overview egg/nest aspect-ratio correction against the supplied source sprite. Scope is limited to egg/nest morphology and clipping at 375, 768, and 1280 px.
- Verdict: **PASS**
- Recommendation: **APPROVE**
- Confidence: **HIGH**

## Evidence inspected

1. Reference sprite (2172 × 724; six equal horizontal 362 × 724 cells): `/Users/ibyeonghyeon/Downloads/ChatGPT Image 2026년 8월 10일 오전 02_53_56.png`
2. Distorted baseline (338 × 312): `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-46698ecc-6e3c-42f0-9ecd-21a1c716b95b.png`
3. Fresh rendered captures (each modified 2026-08-10 03:55:23, after `src/index.css` at 03:53:56):
   - `tmp/pet-qa/egg-aspect-ratio/overview-375.png` (375 × 900)
   - `tmp/pet-qa/egg-aspect-ratio/overview-768.png` (768 × 900)
   - `tmp/pet-qa/egg-aspect-ratio/overview-1280.png` (1280 × 900)
4. Current source and changed implementation: `src/index.css`, `src/components/student/StudentPetCard.tsx`, `src/components/student/StudentOverviewPage.tsx`, `public/pet-egg-stages.png`, plus the complete tracked `git diff` and `git diff --check`.

## Findings

### CRITICAL

None. The egg/nest is not a pasted page screenshot. `StudentPetCard` renders a live section, progress control, and button; the decorative asset is a stage-selected sprite on a semantic `span[role="img"]` (`src/components/student/StudentPetCard.tsx:30-74`).

### HIGH

None. The source sprite is used as a six-cell illustration, not as a substitute for the UI. The stage variable selects the cell in live CSS/DOM (`src/components/student/StudentPetCard.tsx:55-61`; `src/index.css:14937-14950`).

### MEDIUM

None. `background-size: 600% auto` at `src/index.css:14998` preserves the PNG's intrinsic 2172:724 proportion while making each of six cells exactly one rendered-box width. This removes the prior independent `100%` height scaling that caused vertical squashing. The `calc(stage * 20%)` position resolves one whole cell per stage, including stage 5 at 100% (`src/index.css:14997-14998`).

### LOW

None within the requested morphology/clipping scope.

## Visual result

- The baseline visibly flattens the egg and nest vertically.
- In all three fresh captures, the egg remains vertically egg-shaped and the woven nest retains its original height/roundness, matching the relevant source-sprite morphology.
- The full egg, nest rim, leaf accents, and shadow remain inside the pet card at 375, 768, and 1280 px. No edge clipping or horizontal overflow is visible.
- Measured rendered boxes supplied with the evidence are consistent with the captures: 112 × 161.27 px at 375/768 and 121.59 × 175.08 px at 1280.

## Blockers

None.

## Notes

`git diff --check` was clean when inspected. The stated lint/build success was treated as untrusted and is not relied on for this visual verdict; this read-only review did not run a build because it would generate output files.
