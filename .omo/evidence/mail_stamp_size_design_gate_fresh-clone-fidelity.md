# Clone Fidelity Review — mail_stamp_size_design_gate_fresh

## Recommendation

**APPROVE**

## Scope and success criteria

- The mailbox animal profile stamp must show its complete image rather than crop it.
- Its outer envelope stamp must match the bank-worker stamp's outer size.
- Review the current 1280×800 capture against the supplied reference and verify a live, reusable implementation rather than a raster substitute.

## Evidence independently inspected

- Current rendered capture: `/private/tmp/mailbox-stamp-current-1280x800.jpg`
  - Verified signature: JPEG/JFIF (`ff d8 ff e0 … JFIF`), matching the `.jpg` extension.
  - Verified dimensions: 1280×800.
  - Timestamp: 2026-08-24 02:36:47 +0900, later than `src/index.css` (02:31:40 +0900); this evidence is fresh for the inspected CSS.
  - Visual inspection: the squirrel profile remains fully visible inside its pale square stamp; no visible clipping occurs. The adjacent bank-worker stamps use the same outer footprint.
- Reference crop: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-7ea6aacc-6f95-463e-a6aa-fff3041c407b.png`
  - Verified signature: PNG and dimensions: 224×602 RGBA.
  - It is a crop rather than a same-size full-screen pixel baseline, so it supports component geometry comparison, not a full-frame image-diff score.
- Live DOM/component source: `src/components/student/StudentMailboxPage.tsx:244-270` and `src/components/student/StudentMailboxPage.tsx:335-350`.
  - The stamp is a real `<span>` plus conditional `<img>` element. The profile URL is obtained at runtime with `getFailureProfileImage`; no screenshot, canvas, `background-image`, or rasterized UI substitute is used.
- Styling: `src/index.css:291-355` and `src/index.css:485-503`.
  - Profile stamps join the existing bank/donation stamp primitive. Envelope profile and bank stamps both receive `width: 3.75rem; height: 3.75rem` at `src/index.css:325-332`.
  - Letter postmark profile and bank stamps both receive `width: 4.5rem; height: 4.5rem` at `src/index.css:497-502`.
  - The shared image rule is `width: 88%; height: 88%; object-fit: contain` (`src/index.css:335-345`); the profile override preserves `object-fit: contain` (`src/index.css:348-354`). This encodes the supplied rendered measurement: a 52.7892px image inside a 62.0574px outer envelope stamp.
- `git diff --check -- src/index.css` returned no whitespace errors.

## Findings

### CRITICAL

None. The UI is rendered by reusable DOM primitives and real `<img>` content; it is not a pasted screenshot or a background-image mock.

### HIGH

None. The profile additions reuse the established bank/donation stamp rules instead of introducing a one-off geometry branch. Exact size equality follows from the same selector block, and image containment is explicit.

### MEDIUM

None. The supplied reference is a component crop and therefore cannot support a full-page pixel-diff, but it is sufficient for this narrow stamp-size/cropping criterion when combined with the fresh same-build capture and CSS inspection.

### LOW

None.

## Design-system and fidelity assessment

- **Real component tree:** pass. Both list stamps and the detail postmark are live React markup with distinct semantic state (`data-bank`, `data-donation`, `data-profile`).
- **Reusable primitive:** pass. Profile state extends the pre-existing stamp primitive and shares geometry with bank state in both relevant contexts.
- **Token-driven/style consistency:** pass for this change. No new hardcoded color or dimension was introduced for the profile variant; it reuses the existing primitive and the established radius token.
- **Layout/layering:** pass. The envelope stamp remains positioned within the existing envelope layer (`position: absolute; z-index: 3`) and keeps its existing rotation; `overflow: hidden` clips only the stamp boundary, while `contain` prevents source-image cropping.
- **Visual fidelity:** pass for the requested criterion. The current capture visibly shows the complete animal profile at the same apparent outer stamp size as the bank-worker stamp, consistent with the source geometry.

## Blockers

None.
