# Manual QA: student overview balance overlap

Verdict: **PASS**

Scope: focused visual/CJK QA, read-only. No product controls were invoked and no source files were changed.

## Surface and invocation record

| Scenario | Surface | Exact invocation | Observation |
| --- | --- | --- | --- |
| SO-VIS-01 | Browser UI screenshot, Student Overview bottom action rail | `view_image({path: "/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-balance-overlap-fixed.jpg", detail: "original"})` | Directly inspected the full 1076x605 capture at original resolution. |
| SO-CSS-01 | Rendered layout source, `StudentOverviewPage` and balance summary CSS | `nl -ba src/index.css | sed -n '16755,16852p'` and `nl -ba src/components/student/StudentBalanceSummary.tsx | sed -n '22,42p'` | Confirmed the live 3-column grid, bounded balance dock, and Korean labels are DOM/CSS-rendered. |
| SO-METRIC-01 | Fresh browser geometry evidence supplied with the request | Reviewed the supplied values: summary right edge `710.635px`, right card left edge `725.807px`, summary/page internal overflow absent | The 15.172px separation is consistent with the visible screenshot gap; the metric snapshot was not re-executed during this read-only artifact review. |

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| SO-VIS-01 | C1 no overlap or clipping | Student Overview browser screenshot, bottom three-card action rail | `view_image(...student-overview-balance-overlap-fixed.jpg, detail: "original")` | PASS | A1, A2, A3 |
| SO-CJK-01 | C2 Korean labels wrap and remain readable | Center balance card, `사용 가능 고마` / `예약 고마` labels and amounts | Same original-resolution screenshot inspection; source cross-check via `StudentBalanceSummary.tsx` lines 29-40 | PASS | A1, A3 |
| SO-READ-01 | C3 three cards remain readable and aligned | Left `고마 벌기`, center balance, right `고마 쓰기` cards | Same original-resolution screenshot inspection; source cross-check via `StudentOverviewPage.tsx` lines 127-147 and CSS lines 16822-16852 | PASS | A1, A2, A4 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| SO-ADV-OVERLAP | C1 | inter-card overlap | Center balance card must end before the right card begins, with a visible gap. | PASS | A1, A5 |
| SO-ADV-CLIP | C1/C2 | content clipping or ellipsis | `예약 고마` and its amount must be fully visible; no glyph or baseline may be clipped. | PASS | A1, A2, A3 |
| SO-ADV-CJK | C2 | unnatural CJK wrap/orphan | Short Korean labels must remain intact on one line and not split into orphan syllables. | PASS | A1, A3 |
| SO-ADV-ALIGN | C3 | three-card alignment drift | The three cards must share a common bottom rail, readable internal alignment, and preserve the left/right action hierarchy. | PASS | A1, A4 |
| SO-ADV-HOVER-MUTATION | C1-C3 | live-data mutation | This visual review must not click controls or mutate balances, bids, awards, or history. | NOT_APPLICABLE | A1 |

## artifactRefs

| id | kind | description | path |
| --- | --- | --- | --- |
| A1 | screenshot | Original-resolution Student Overview capture reviewed directly; non-empty 1076x605 JPEG, 106335 bytes. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-balance-overlap-fixed.jpg` |
| A2 | source | Current layout rules for the balance dock and three-column destinations grid, including `minmax(0, 1fr)`, fixed balance width, and card areas. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16755` |
| A3 | source | Current DOM labels and balance summary structure for `사용 가능 고마`, `예약 고마`, and amounts. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBalanceSummary.tsx:29` |
| A4 | source | Current Student Overview order: mission card, balance dock, purchase card. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx:127` |
| A5 | runtime-metrics | Fresh geometry values supplied with the request and cross-checked against the screenshot; summary/right-card separation is `725.807 - 710.635 = 15.172px`. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-balance-overlap-fixed-manual-qa.md` |

## Findings

No concrete product blockers found. The screenshot shows no overlap, no visible clipping, intact Korean labels, and readable alignment across all three cards. The supplied runtime metrics agree with that visual result.
