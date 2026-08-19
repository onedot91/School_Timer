# Manual QA: student securities lower action-panel dedup

Verdict: **REVISE**

Scope: read-only visual inspection of the supplied reference and new student securities screenshots. No browser navigation/reload and no investment, balance, bid, or currency mutation was invoked.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | SC-1: lower action panel must not repeat selected stock name | 1024 CSS-pixel student securities screenshot | `view_image(/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1024.png)`; compare lower panel with reference `view_image(/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-df510b70-e19b-419e-b291-3100c051dd9b.png)` | PASS — no visible selected-stock heading in the lower panel | `R1`, `N1`, `C1` |
| S2 | SC-1: lower action panel must not repeat selected stock name | 1280 CSS-pixel student securities screenshot | `view_image(/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1280.png)` | PASS — panel starts at `투자할 고마`; selected name remains only in the card | `R1`, `N2`, `C1` |
| S3 | SC-1: lower action panel must not repeat selected stock name | 1366 CSS-pixel student securities screenshot | `view_image(/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1366.png)` | PASS — no duplicate selected-stock label | `R1`, `N3`, `C1` |
| S4 | SC-2: reason copy must be prominent and usable | 1024/1280/1366 market cards | `view_image` each of `N1`, `N2`, `N3`; inspect reason boxes and Korean wrapping | PASS for visible card content — dark serif copy, bordered reason region, and scroll affordance are visible; 1024 capture integrity remains a separate blocker | `N1`, `N2`, `N3`, `C2` |
| S5 | SC-3: amount input and both action controls remain clear with no cutoff | 1024 CSS-pixel student securities screenshot | `view_image(/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1024.png)`; inspect lower panel frame | FAIL — only `투자할 고마` and the input's upper edge are visible; `투자하기` and `투자금 찾기` are not visible in the supplied frame | `N1`, `C3` |
| S6 | SC-3: amount input and both action controls remain clear with no cutoff | 1280 CSS-pixel student securities screenshot | `view_image(/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1280.png)`; inspect lower panel frame | PASS — amount field and both disabled buttons are present, separated, and not overlapping | `N2`, `C3` |
| S7 | SC-3: amount input and both action controls remain clear with no cutoff | 1366 CSS-pixel student securities screenshot | `view_image(/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1366.png)`; inspect lower panel frame | PASS — amount field and both disabled buttons are fully visible with clear spacing | `N3`, `C3` |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A1 | Evidence contract for requested viewport captures | capture integrity / file signature and dimensions | Each claimed PNG should be a valid PNG at the requested viewport dimensions | FAIL — all three `.png` files are JPEG data; dimensions are 723×565, 903×565, and 964×565, not 1024/1280/1366 captures. `visual-qa.mjs image-diff` exits `not a PNG file (bad signature)` | `N1`, `N2`, `N3`, `C4` |
| A2 | SC-3 action-control visibility | narrow viewport / fold clipping | At 1024 the lower action panel must expose the input and both controls in the captured usable frame | FAIL — 1024 evidence does not show either action button; 1280 and 1366 do | `N1`, `N2`, `N3`, `C3` |
| A3 | SC-2 readable Korean reason copy | CJK wrapping and text usability | Korean reasons should remain readable without detached particles or clipped baselines | PASS on the visible card regions — no obvious orphaned particles, tofu, or overlap; source also uses `word-break: keep-all` and a scrollable bordered reason box | `N1`, `N2`, `N3`, `C2` |
| A4 | SC-1 visible dedup with accessible context retained | source/render consistency | Render should omit visible duplicate while retaining selected-stock context for assistive technology | PASS — source renders no `.student-investment-stock-choice`, while the section retains `aria-label={`${selectedStock.name} 투자 거래`}` | `C1`, `C5` |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| R1 | reference-screenshot | Supplied before screenshot showing duplicated `햇살문구` heading in lower panel | `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-df510b70-e19b-419e-b291-3100c051dd9b.png` |
| N1 | screenshot | Supplied 1024-named after capture; visually shows reason cards and truncated lower panel | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1024.png` |
| N2 | screenshot | Supplied 1280-named after capture; lower panel contains amount input and both controls | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1280.png` |
| N3 | screenshot | Supplied 1366-named after capture; lower panel contains amount input and both controls | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-1366.png` |
| C1 | source | Rendered panel has no visible selected-stock choice block; accessible panel name remains | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentInvestmentActionPanel.tsx:103` |
| C2 | source | Reason copy uses larger serif size, keep-all wrapping, border, min/max height, and vertical scrolling | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15371` |
| C3 | source | Amount/action grid and responsive layout declarations | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15573` |
| C4 | command-log | File signature/dimension checks and failed PNG diff validation | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-integrity-check.txt` |
| C5 | source | Retained `aria-label` with selected stock name and explicit amount input label | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentInvestmentActionPanel.tsx:104-108` |

## concreteFindings

1. The 1024 supplied frame does not expose either lower-panel action button. Re-capture a full, valid 1024×800 (or explicitly documented target-height) screenshot after ensuring the panel is within the scroll/fold, then re-run this scenario.
2. Re-capture all three artifacts as actual PNGs at the claimed viewport dimensions; the current JPEG payloads cannot pass the visual-qa PNG gate.
