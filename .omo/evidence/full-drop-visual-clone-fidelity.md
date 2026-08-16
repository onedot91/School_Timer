# Clone fidelity review: full-drop visual QA

## Recommendation

**APPROVE**

## Scope and evidence inspected

- `src/components/student/StudentCharacterGacha.tsx` (current diff; especially lines 104–129 and 160–188)
- `src/index.css` (current diff; especially lines 16731–16803 and 16856–16931)
- `src/lib/studentGachaMotion.ts` (lines 14–24)
- All nine rendered states, opened directly:
  - `/private/tmp/school-timer-claw-full-drop-qa/ready-{1024,1280,1366}.png`
  - `/private/tmp/school-timer-claw-full-drop-qa/contact-{1024,1280,1366}.png`
  - `/private/tmp/school-timer-claw-full-drop-qa/lift-{1024,1280,1366}.png`
- Independent integrity and visual reviewers, both PASS with no blockers.

The source files predate every supplied capture, so the visual states are fresh relative to the reviewed change.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

- **[evidence]** Every capture is JPEG/JFIF-encoded despite a `.png` extension. This is a naming/metadata defect, not a pixel or product defect; dimensions and visual compositing are correct. Correct the capture extension or encode as real PNG in the next evidence run.
- **[product]** The pre-existing gacha surface uses some feature-local visual values (for example `src/index.css:16731`). The motion diff itself uses dynamic CSS custom properties and adds no new one-off visual values; this is accepted pre-existing design debt, not a blocker for this change.

## Verified design and motion behavior

- The machine is an actual DOM/CSS component tree: rail, cable, motor, independent curved jaws, floor targets, caught capsule, and controls are separately rendered. No screen-sized image or `background-image` substitutes for the interaction.
- `StudentCharacterGacha.tsx:104–118` measures the rendered selected target and caught-capsule centers at runtime. `studentGachaMotion.ts:19–24` produces the responsive drop distance and cable scale from those measurements.
- The animation uses one 2.3-second timeline: the claw reaches the selected floor capsule; jaws visually close; source target fades only while caught copy fades in; then the same aqua capsule lifts. The overlap from 48–54% in `src/index.css:16886–16897` avoids a visible teleport.
- At 1024×800, 1280×800, and 1366×800 all ready/contact/lift frames remain inside the cabinet; no clipping, control collision, horizontal overflow, CJK glyph truncation, or identity swap is visible.

## Blockers

None.
