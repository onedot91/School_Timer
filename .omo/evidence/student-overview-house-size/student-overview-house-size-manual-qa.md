# Student overview house-size — manual QA matrix

Verdict: **PASS**

Fresh read-only Pass B review of `/private/tmp/school-timer-overview-house-size-valid.png`.
The ULW status command was unavailable (`omo: command not found`), so the caller evidence directory `.omo/evidence/student-overview-house-size/` was used as the fallback attempt directory. No product files were edited.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| VQ-B-HOUSE-01 | DESIGN.md:76; src/index.css:15297-15298, 16233-16242 — house uses shared 46% × 85% frame | Student overview static PNG, 1117×837 | `view_image("/private/tmp/school-timer-overview-house-size-valid.png", detail:"original")` | PASS | `capture-valid`, `source-contract` |
| VQ-B-HOUSE-02 | Centering, bookshop hierarchy, ground alignment, clipping/collision intent | Student overview home-artwork canvas | `view_image("/private/tmp/school-timer-overview-house-size-valid.png", detail:"original")` | PASS | `capture-valid`, `visual-observation` |
| VQ-B-HOUSE-03 | CJK precision on visible overview labels | Student overview Korean UI copy | `view_image("/private/tmp/school-timer-overview-house-size-valid.png", detail:"original")` | PASS | `capture-valid`, `cjk-observation` |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-HOUSE-01 | DESIGN.md:76; CSS frame contract | Oversized/future-asset scaling | Shared frame should make the house modestly larger than the bookshop without escaping its stage | PASS | `capture-valid`, `source-contract` |
| ADV-HOUSE-02 | src/index.css:16236-16242 | Off-center or bottom drift | House should remain centered and ground-aligned via 49.5% / 12% / contain / center-bottom | PASS | `capture-valid`, `source-contract` |
| ADV-HOUSE-03 | Student overview visual intent | Canvas clipping or building collision | House and bookshop should remain fully visible and spatially separated | PASS | `capture-valid`, `visual-observation` |
| ADV-CJK-01 | DESIGN.md:Responsive Behavior; visible Korean overview copy | CJK glyph loss, clipping, or unnatural orphaning | Korean glyphs remain intact and readable without detached one-character lines | PASS | `capture-valid`, `cjk-observation` |
| ADV-EVIDENCE-01 | visual-qa capture hygiene | Invalid signature or dimensions | Supplied `.png` must be a non-empty valid PNG at 1117×837 | PASS | `capture-valid` |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| capture-valid | image + CLI validation | Directly inspected PNG; signature and dimensions verified | `/private/tmp/school-timer-overview-house-size-valid.png` |
| visual-observation | QA note | Pixel-level visual observations for house/bookshop size, alignment, and separation | `.omo/evidence/student-overview-house-size/student-overview-house-size-pass-b-evidence.md` |
| cjk-observation | QA note | Visible Korean glyph and wrapping observations | `.omo/evidence/student-overview-house-size/student-overview-house-size-pass-b-evidence.md` |
| source-contract | source excerpts | Design token, shared CSS frame, and both-asset consumer evidence | `DESIGN.md:76`; `src/index.css:15297-15298,16233-16242`; `src/components/student/StudentPetStage.tsx:111-116` |

## Review limitation

The environment exposed no independent oracle/subagent tool, so parallel Pass A/Pass B oracle dispatch was unavailable. The verdict above is based on the required direct image inspection, capture validation, and source-contract comparison.
