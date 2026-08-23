# Mail Stamp Size Design Gate — Clone Fidelity Review

## Decision

- **Recommendation:** REQUEST_CHANGES
- **Pass-A verdict:** REVISE
- **Scope:** Mailbox profile stamp must show the full animal image and use the same outer width and height as the bank-worker stamp.
- **Review method:** Read-only inspection of current source, the supplied 1280×800 runtime capture, the supplied reference image, and the current diff. No application state or user data was modified.

## Evidence inspected

- `/private/tmp/mailbox-stamp-1280x800.png`
  - mtime: 2026-08-24 02:33:50; 1280×800.
  - Visually, the profile stamp shows the complete squirrel artwork and its outer frame matches the two bank-worker frames in the envelope list.
  - **Artifact defect:** `file` and `sips` identify it as `JPEG` with no alpha, despite its `.png` name. It is therefore not a valid PNG evidence artifact.
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-7ea6aacc-6f95-463e-a6aa-fff3041c407b.png`
  - Valid 224×602 RGBA PNG reference crop. It shows the intended profile and bank-stamp envelope anatomy.
- `src/components/student/StudentMailboxPage.tsx:235-270,334-350`
  - Renders live `<img>` elements in both list and opened-letter stamp primitives; bank and donation branches remain ahead of the profile branch.
- `src/index.css:291-355,485-503`
  - Profile and bank variants share the same 3.75rem square envelope-stamp selector and the same 4.5rem square postmark selector.
  - Both profile and bank images use 88% width/height and `object-fit: contain`; the profile-specific rule does not replace this with a crop fit.
- `src/lib/failureExhibition.ts:9-60,100-113` and `public/failure-profiles/thumbs/19-squirrel.png`
  - The rendered profile asset is a normal 192×192 image selected through the existing profile-assignment helper, not a pasted UI screenshot or CSS background image.
- Supplied runtime measurement: both profile-envelope and bank-envelope outer boxes are 62.0574px square; profile image is 52.7892px square with `object-fit: contain`; no horizontal overflow.

## Findings

### CRITICAL

None.

### HIGH

None in the product implementation. The stamp is a real DOM image within an existing reusable primitive; it is not a raster replacement for UI, and the relevant size and fit rules are shared with the bank stamp.

### MEDIUM

None.

### LOW

None.

### EVIDENCE BLOCKER

1. **[evidence] The supplied actual capture has the `.png` extension but a JPEG/JFIF signature.**
   - Location: `/private/tmp/mailbox-stamp-1280x800.png`.
   - Impact: It fails capture-signature hygiene, so this review cannot issue an evidence-backed PASS from that artifact even though the inspected pixels and source support the requested layout.
   - Required before approval: provide a freshly captured, correctly encoded PNG at 1280×800 DPR 1 from the current build; preserve the same mailbox state so it can be rechecked.

## Non-regression facts to retain

- The profile and bank envelope stamps derive their 3.75rem square outer geometry from the same selector at `src/index.css:325-333`.
- The profile and bank images derive the 88% contained geometry from the same selector at `src/index.css:335-346`.
- The profile and bank opened-letter postmarks derive their 4.5rem square outer geometry from the same selector at `src/index.css:497-503`.
- The visible 1280×800 capture shows no horizontal overflow and no animal-image clipping attributable to CSS.

## Blockers

- Replace the invalidly encoded `.png` capture with a fresh, genuine PNG evidence artifact. No product-code blocker was found in the reviewed stamp implementation.
