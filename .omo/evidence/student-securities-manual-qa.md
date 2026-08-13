# Manual QA: student securities redesign

Verdict: **FAIL**

Scope: read-only manual review of the student securities portfolio and market surfaces. No buy, sell, balance, holding, or currency-history action was invoked.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | `DESIGN.md:163-168` portfolio-first hierarchy | Student portfolio route | `http://localhost:3003/#student-store-securities`; select disposable entry 1; reload; inspect DOM/screenshot | FAIL | `A1`, `A2`, `A3` |
| S2 | `DESIGN.md:163,168` separate market page | Student market route | From S1, click `종목 사고팔기`; inspect `#student-store-securities-trade` DOM without clicking trade controls | PASS | `A4`, `A5` |
| S3 | `DESIGN.md:168` red ▲ / blue ▼ Goma movement | Isolated fake market state plus source trace | `node --import tsx -e ...getDailyStockQuotes/upsertStudentStockMarketEntry/applyStudentEconomyAction...`; no real student state | PASS (logic only) | `A5` |
| S4 | `DESIGN.md:168` market news and prior reasons | Market card disclosure | Click first `지난 소식`; inspect `aria-expanded` and empty-history DOM; no trade action | PASS (control only) | `A4`, `A5` |
| S5 | Project QA contract | TypeScript/test/build checks | `npm test`; `npm run lint`; `npm run build` | PASS | `A6` |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A1 | `DESIGN.md:164,168` | target capture integrity | Both requested artifacts must be fresh, composited PNGs at exactly 1280×800 | FAIL — portfolio artifact is absent; trade artifact is JPEG data at 1076×605 despite `.png` extension | `A1` |
| A2 | `DESIGN.md:168` | owned portfolio state | Owned count, total profit, payout, and per-stock movement must be visibly rendered | FAIL — prohibited mutation means no real owned-state UI run; supplied portfolio screenshot is missing. Source/isolated logic alone is not visual evidence | `A1`, `A2` |
| A3 | `DESIGN.md:168` | positive/negative movement | Gain renders red `▲ n 고마`; loss renders blue `▼ n 고마`; no percentage | PASS — source maps positive/negative amounts to `▲`/`▼`, Goma counts, and documented red/blue classes; no target-sized gain/loss capture exists | `A2` |
| A4 | `DESIGN.md:168` | market content/state | Each market card exposes ownership, news, price, buy/sell, and prior reasons | PASS for empty/unowned state — all four cards and the disclosure control were observed; populated news/prior-reason rendering remains unverified | `A4`, `A5` |
| A5 | Project QA contract | mutation safety | Read-only review must not change balances, holdings, or currency history | PASS — only entry selection, route navigation, and prior-news disclosure were invoked; no trade button was clicked | `A3`, `A5` |
| A6 | Project QA contract | regression/build | Tests, typecheck, and production build must complete successfully | PASS — 71 tests passed, `tsc --noEmit` passed, Vite build exited 0 | `A6` |
| A7 | `DESIGN.md:164-166,168` | viewport/fold/CJK overflow | Both pages must be visually checked at the 1280×800 Chromebook target with no clipping | FAIL — only a 1076×605 JPEG trade capture exists; lower cards are visibly cut off and the portfolio target capture is absent | `A1` |

## Concrete defects

1. Required portfolio evidence is missing: `.omo/evidence/student-securities-portfolio-1280.png` does not exist.
2. Required trade evidence is invalid for the requested viewport: `.omo/evidence/student-securities-trade-1280.png` is JPEG data, 1076×605, not a 1280×800 PNG. Its lower cards are clipped in the visible frame.
3. The owned/gain/loss populated visual states were not run because doing so would require a balance/holding mutation; therefore the requested portfolio-first result is not independently proven by rendered evidence.

## Residual unverified risks

- Populated teacher-authored news and historical reason rows were not available in the disposable profile, so their Korean wrapping and card height at 1280×800 remain unverified.
- The owned branch changes the market action to sell in source, and isolated logic covers buy/sell arithmetic, but no rendered owned-card screenshot was captured.

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot-integrity | Requested trade screenshot inspection; invalid JPEG/1076×605. Requested portfolio screenshot is absent. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-trade-1280.png` |
| A2 | source-and-logic | DOM/source trace and isolated fake-state quote, history, buy, and sell output. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/dom-and-logic-evidence.md` |
| A3 | browser-action-log | Exact read-only invocations and mutation-safety record. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/browser-action-log.md` |
| A4 | browser-screenshot | Fresh empty portfolio capture; non-empty but backend JPEG/1075×672, not valid target PNG. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/portfolio-empty-1280.png` |
| A5 | browser-screenshot | Fresh market and expanded-history captures; non-empty but backend JPEG/1075×672. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/trade-empty-1280.png` |
| A6 | verification-log | `npm test`, `npm run lint`, and `npm run build` results. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/dom-and-logic-evidence.md` |
