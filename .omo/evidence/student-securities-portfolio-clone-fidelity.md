# Student securities portfolio and trade page — clone-fidelity review

## Recommendation

**REQUEST_CHANGES**

## Scope and evidence inspected

- Requested evidence paths (both absent at review time):
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-portfolio-1280.png`
  - `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-trade-1280.png`
- [`src/components/student/StudentSecuritiesPage.tsx`](../../src/components/student/StudentSecuritiesPage.tsx)
- [`src/components/student/StudentStockMarketPage.tsx`](../../src/components/student/StudentStockMarketPage.tsx)
- [`src/components/student/StudentStockTrend.tsx`](../../src/components/student/StudentStockTrend.tsx)
- Relevant rules in [`src/index.css`](../../src/index.css)
- The governing student Chromebook and token contract in [`DESIGN.md`](../../DESIGN.md), especially lines 50–51 and 163–168.
- Integration trace in [`src/components/student/StudentStorePage.tsx`](../../src/components/student/StudentStorePage.tsx) and trade behavior in [`src/lib/studentEconomy.ts`](../../src/lib/studentEconomy.ts).

The requested PNGs could not be opened or inspected because neither file exists. Consequently, this review cannot verify rendered visual fidelity, Korean line breaking, clipping, or the 1280×800 fold.

## Findings

### CRITICAL

None found in the inspected source. The reviewed UI is composed from live React elements and shared `StudentStockIcon` / `StudentStockTrend` primitives; no screenshot or CSS background-image substitute is present in the reviewed components.

### HIGH

1. **[evidence] The required visual proof is missing, so a 1280×800 Chromebook review cannot pass.** Both requested PNG paths are absent. This leaves the portfolio and trade-page layout, legibility, Korean wrapping, vertical fit, and expanded-history state unverified.
   - Required fix: provide fresh, fully composited PNG captures at exactly 1280×800 CSS px for both pages. Include portfolio empty and owned states; trade unowned, owned, up/down, and expanded-history states.

2. **[product] The new securities surface is not driven by the documented design tokens.** `DESIGN.md:50–51` defines `--student-stock-up`, `--student-stock-up-soft`, `--student-stock-down`, and `--student-stock-down-soft`, but the new styles redefine them per component as raw hex values (`src/index.css:15049–15053`, `15091`) and introduce further one-off colors for the summary, icons, trend neutral state, news, sell action, and history (`src/index.css:15059–15061`, `15085–15087`, `15100–15107`). This breaks the token contract and permits drift between the two pages.
   - Required fix: declare/use the documented semantic tokens centrally, add any missing semantic surface/text/action tokens to `DESIGN.md`, and replace the raw new-surface color literals with those tokens.

### MEDIUM

None that can be verified without the requested rendered evidence.

### LOW

None.

## Blockers before approval

1. Fresh, valid 1280×800 PNG evidence for both requested pages and the listed meaningful states.
2. Tokenize all newly introduced securities colors and remove the component-scoped/raw color overrides.

## Note on integrity

The source does use real reusable UI primitives: `StudentStockIcon` and `StudentStockTrend` are rendered by both pages (`StudentSecuritiesPage.tsx:7,40–43,59–63`; `StudentStockMarketPage.tsx:10,41–43,71`). This is not, however, sufficient to approve visual fidelity without the requested render artifacts.
