# Student securities visual QA / clone-fidelity review

## Scope and verdict

- Goal: verify the Chromebook `1280×800` student securities UI for Korean third graders: hierarchy, legibility, overflow, +/- differentiation, and buy-only / next-day settlement clarity.
- Recommendation: **REQUEST_CHANGES**
- Review mode: read-only; no product source was changed.

## Evidence inspected

1. `/private/tmp/student-securities-qa.png` — SHA-256 `fc09f658113c2310b582787716edcfa0f23db0401c53726ffe922bc7a4db2108`; modified `2026-08-13 23:15:13 +0900`.
   - Inspected directly. It visually shows the resting, four-card state with all changes at `0 고마`.
   - File inspection: the path has a `.png` extension, but its JFIF signature is `ff d8 ff e0 … JFIF`, so it is JPEG; its decoded size is `1075×672`, not `1280×800`.
2. `src/components/student/StudentSecuritiesPage.tsx` (current working-tree diff and rendered structure), especially lines 23–79.
3. `src/index.css` (current working-tree diff), especially lines 15049–15122.
4. `DESIGN.md`, semantic-token and Chromebook constraints, especially the `--student-chromebook-width` / `--student-chromebook-height` contract and the minimum readable supporting-text rule.
5. Related behavior trace: `src/lib/studentEconomy.ts:497–508`, `src/lib/studentEconomy.test.ts:107–128`, and status-message mapping in `src/pages/AuctionPage.tsx:1352`.
6. `git diff` for the two reviewed source files and `DESIGN.md`; no staged diff was present for them.

## What is confirmed good

- The surface is live DOM, not a pasted screenshot: `StudentSecuritiesPage` maps quote data into four `<article>` cards and uses real `<button>` controls (`StudentSecuritiesPage.tsx:35–76`). No screenshot/background-image substitute appears in the reviewed component or CSS.
- Resting-state hierarchy is clear: page title, section title, price/change, then one dominant purchase action. In the supplied frame, the four cards fit without visible outer-page clipping.
- The implementation makes non-zero changes distinguishable in more than color: it renders `+` for gains and `-` for losses (`StudentSecuritiesPage.tsx:40,46,66–68`) and assigns distinct up/down treatment (`index.css:15068–15076`). Zero remains neutral in the supplied state.
- The business rule is genuinely buy-only with next-day settlement: purchases are debited once, stored as a pending purchase, and settled on the next Korean date (`studentEconomy.ts:497–508`; tested in `studentEconomy.test.ts:107–128`).

## Findings

### CRITICAL

- None found in the reviewed component. No raster or background-image substitution was found.

### HIGH

1. **[evidence] The supplied visual evidence cannot certify the requested Chromebook viewport.** `/private/tmp/student-securities-qa.png` is a `1075×672` JPEG incorrectly named `.png`, rather than a composited `1280×800` PNG. The screenshot is newer than the two reviewed source files, but its type and dimensions invalidate it as the requested reference capture. This also leaves expanded-history, purchased, gain, and loss states unverified at the target size.
   - Required before approval: recapture the live UI at exactly `1280×800` CSS px as a real PNG, then capture the resting, purchased, positive-change, negative-change, and expanded-history states.

2. **[product] A child learns “next-day automatic settlement” only after the immediate, balance-changing purchase.** Before purchase, the visible state is “아직 살 수 있어요” and the primary button says only “15 고마로 사기”; after it is clicked, the same disabled button changes to “내일 자동으로 정산돼요” (`StudentSecuritiesPage.tsx:45,50–52`). The action handler spends the currency immediately (`studentEconomy.ts:500–508`). For the stated third-grade, buy-only flow, the child should understand *before* spending that they buy today and learn the result tomorrow.
   - Required before approval: make the pre-purchase primary action or adjacent, always-visible helper state communicate the two-step outcome in plain Korean (buy today → automatic result tomorrow), without relying on the post-purchase disabled label or toast.

3. **[product] New securities styling bypasses the documented token system with many one-off raw colors.** `DESIGN.md` defines the semantic Apple/student palette, but the new card rules add undeclared hex values for card, border, trends, text, disabled state, and history surfaces (`src/index.css:15046–15047,15067–15089`). Examples include `#d9e5df`, `#fffefa`, `#b64b45`, `#386c9f`, and `#526159`. This is not token-driven and creates different values for the same positive/negative colors (`#b64b45` vs `#a83f3b`, `#386c9f` vs `#315f91`).
   - Required before approval: introduce/reuse named semantic tokens in `DESIGN.md` and CSS custom properties, then reference those tokens consistently for card surfaces and gain/loss states.

### MEDIUM

1. **[product] Several visible student labels violate the documented 14px minimum.** The status text is `0.82rem` (13.12px), the history trigger is `0.86rem` (13.76px), and expanded history uses `0.74rem` (11.84px) in `src/index.css:15073,15083,15086`. `DESIGN.md` states student-facing supporting text must not render below `0.875rem` at the 1280×800 reference viewport. These are key labels for third graders, not admin metadata.
   - Required before approval: raise these to the declared readable-text token/minimum and recapture at 1280×800.

2. **[product] Expanded-history visibility/overflow is not demonstrated and is risky in the fixed-height card.** At desktop widths each card uses `overflow-y: auto` (`src/index.css:15067`); when “지난 오르내림 보기” inserts up to four rows below the trigger (`StudentSecuritiesPage.tsx:61–72`), the new content can be below the card fold with no focus move or scroll-into-view. The resting capture cannot demonstrate that the revealed result is visible or understandable.
   - Required before approval: verify the expanded state at 1280×800 and ensure the newly revealed records are immediately visible or that the scroll affordance is explicit and usable.

### LOW

- The rest-state card layout leaves a large blank center when market comments are absent. It preserves clean action alignment, but it lowers information density without adding a pre-purchase explanation. Address the settlement explanation first; reassess the whitespace after that content is placed.

## Blockers before approval

1. A valid, fresh live capture set at exact `1280×800` PNG for all named states.
2. Pre-purchase explanation of the buy-today / automatic-next-day-settlement rule.
3. Replace one-off securities colors with documented semantic tokens.
4. Raise student-visible supporting/history text to the declared 14px minimum and verify expanded-history visibility.
