# Manual QA: securities lower action panel

Verdict: **PASS**

Scope: read-only audit of the current lower securities action panel. Live student balances, holdings, bids, awards, and currency history were not mutated. `omo ulw-loop status --json` was unavailable (`omo: command not found`), so artifacts use the caller evidence directory.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| SAP-1024 | responsive lower panel at 1024 CSS px | Student securities lower action panel | Use supplied read-only DOM geometry for viewport 1024; inspect `StudentInvestmentActionPanel.tsx:103-119` and `src/index.css:15310,15617-15623` | PASS — selected `구름운수`, amount field, and both actions are contained; no overlap or horizontal overflow; input share 26.9% | `DOM1`, `SRC1` |
| SAP-1280 | responsive lower panel at 1280 CSS px | Student securities lower action panel | Use supplied read-only DOM geometry for viewport 1280; inspect same source ranges | PASS — selected `구름운수`, amount field, and both actions are contained; no overlap or horizontal overflow; input share 24.4% | `DOM1`, `SRC1` |
| SAP-1366 | responsive lower panel at 1366 CSS px | Student securities lower action panel | Use supplied read-only DOM geometry for viewport 1366; inspect same source ranges | PASS — selected `구름운수`, amount field, and both actions are contained; no overlap or horizontal overflow; input share 24.9% | `DOM1`, `SRC1` |
| SAP-CONTEXT | selected-stock context and control consistency | Student securities lower action panel | Read source only; do not select a stock or invoke a trade | PASS — section accessible name is `${selectedStock.name} 투자 거래`; visible selected-stock field and `투자하기`/`투자금 찾기` remain present | `SRC1`, `DOM1` |
| SAP-VERIFY | regression/build verification | Repository checks | `npm test -- --run`; `npm run lint`; `npm run build` | PASS — 99/99 tests, typecheck, and production build passed | `RUN1` |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-CJK | CJK text integrity | selected stock name wrapping | `구름운수` must stay inside the selected-stock cell without clipping or an orphaned glyph | PASS — `min-width: 0` and `overflow-wrap: anywhere`; supplied DOM reports the selected stock visible at all three widths | `SRC1`, `DOM1` |
| ADV-LABEL | input accessibility | label/name computation | Number input must expose `투자할 고마` to assistive technology and retain a visible label | PASS — wrapping `<label>` plus explicit `aria-label="투자할 고마"` at `StudentInvestmentActionPanel.tsx:110-113` | `SRC1` |
| ADV-STATE | disabled semantics | unavailable market/save/amount/holding states | Native disabled controls must be unavailable when the corresponding state is invalid, while status/context remain exposed | PASS — native `disabled` is used for input and both buttons; `aria-busy` is present while saving; `canInvest`/`canWithdraw` preserve state guards | `SRC1` |
| ADV-FOCUS | keyboard accessibility | visible focus indicator | Keyboard focus on the amount input must be visibly distinguishable | PASS — wrapper `:focus-within` at `src/index.css:15465` adds accent border and a 3px focus ring; native focus invocation was unavailable in the isolated browser probe, so this PASS is source/cascade-based. | `SRC1` |
| ADV-MUTATION | project QA safety contract | live-data mutation | Read-only QA must not change balances, holdings, awards, bids, or currency history | PASS — only source inspection, supplied DOM evidence review, and repository checks were performed; no browser navigation/reload/control invocation | `SRC1`, `RUN1` |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| `SRC1` | source-audit | Source and CSS audit, including exact line references and focus finding | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/securities-action-panel-source-audit.md` |
| `DOM1` | dom-geometry-summary | Provided read-only 1024/1280/1366 DOM geometry summary: selected `구름운수`, contained controls, no overlap/overflow, and 26.9%/24.4%/24.9% input shares | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/securities-lower-action-panel-gate-review.md` |
| `RUN1` | verification-log | Fresh local test/typecheck/build verification | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/verification-run.log` |

## Residual evidence note

The isolated browser probe could not invoke native `focus()`. The focus result is therefore verified from the current CSS cascade, while the supplied 1024/1280/1366 DOM geometry remains the direct responsive evidence.
