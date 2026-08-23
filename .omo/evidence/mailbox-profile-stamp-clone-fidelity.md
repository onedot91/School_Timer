# Mailbox profile-stamp clone fidelity review

## Scope and decision

- **Goal:** For student-to-student mail, render the counterpart student's animal profile as the stamp in both the envelope list and opened letter. Preserve bank, donation, teacher, and system stamps.
- **Recommendation:** **APPROVE** (PASS)
- **Review mode:** Read-only source and visual-evidence inspection. No UI/data mutations were made.

## Evidence inspected

- `src/components/student/StudentMailboxPage.tsx`
  - Counterpart resolution uses the sender for inbox and recipient for sent mail at lines 55–61.
  - The shared profile-image lookup is a live React value at lines 105–110 and 235–238, not a pasted/rasterized UI substitute.
  - Envelope stamps render live `<img>` DOM elements at lines 258–268; opened-letter postmarks do likewise at lines 338–348.
  - Bank and donation branches have precedence over a profile in both locations (lines 259–264 and 339–344). Teacher/system letters without a counterpart student number retain the prior `Stamp` fallback.
- `src/index.css`
  - The profile uses the existing stamp primitive and only adds its image-fit treatment at lines 314–354. No new color, typography, or spacing literals were introduced for this change; it retains the mailbox's established material/border styling.
- `src/lib/failureExhibition.ts:83–99`
  - The supplied capture's student-2 profile resolves through the existing daily assignment ring; the inspected catalog includes `/failure-profiles/thumbs/33-monkey.png` at line 42.
- Visual captures, directly inspected at their native dimensions:
  - `.omo/evidence/mailbox-profile-stamp-20260824/mailbox-1024.png` (1024×800)
  - `.omo/evidence/mailbox-profile-stamp-20260824/mailbox-1280.png` (1280×800)
  - `.omo/evidence/mailbox-profile-stamp-20260824/mailbox-1366.png` (1366×800)
  - Each shows the identical monkey profile in the selected envelope and its opened-letter postmark. The two bank envelopes retain the bank character stamp. The subject, signature, controls, and layered-envelope hierarchy remain readable, with no observed horizontal overflow.

## Findings

### CRITICAL

None. The profile is rendered as a live DOM image inside the existing reusable stamp primitive; there is no screenshot/background-image substitution.

### HIGH

None. The special-stamp precedence is explicit and consistent in list and detail render paths.

### MEDIUM

None.

### LOW

None.

## Blockers

None.
