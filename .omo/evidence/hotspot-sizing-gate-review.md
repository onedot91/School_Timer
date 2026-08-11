# Hotspot sizing gate review

- recommendation: APPROVE
- blockers: []
- originalIntent: Overview mailbox and store donation hotspots should visually fit their targets without excessive focus/touch outlines.
- desiredOutcome: Mailbox outline comfortably encloses the mailbox; donation character is slightly smaller and centered with a close outline; neither screen has overlap or horizontal overflow.
- userOutcomeReview: PASS. The overview focus outline closely encloses the visible mailbox and surrounding post/base without extending across the scene. The donation character is visibly centered in the empty lot, scaled smaller than the lot, and its focus outline stays close to it. Both 1280x720 captures show no obvious overlap or horizontal overflow.
- checkedArtifacts:
  - `.omo/evidence/hotspot-sizing/overview-mailbox-focus.png` (1280x720, captured 2026-08-12 00:36:02)
  - `.omo/evidence/hotspot-sizing/store-donation-focus.png` (1280x720, captured 2026-08-12 00:36:02)
  - `src/index.css:12050-12057`
  - `src/index.css:14716-14727`
  - `git diff -- src/index.css`
- skillPerspectiveChecks:
  - visual-qa: Both requested focused states were directly inspected at original resolution; no visible clipping, overlap, or horizontal overflow.
  - remove-ai-slops: Relevant CSS is direct selector-level sizing/positioning; no extraction, parsing, normalization, tests, or deletion-only/tautological coverage was introduced for this narrow change.
  - programming: Relevant rules use existing selectors and responsive percentage geometry; no new dependency, API, or unrelated implementation mechanism is involved.
- evidenceGaps:
  - The files use JPEG encoding despite a `.png` suffix. They remained directly decodable and fully composited, so this is a non-blocking evidence-format note, not a failed user-visible criterion.
  - This review covers only the supplied 1280x720 screenshots; no additional viewport was required by the stated criteria.
