# Student securities redesign — clone/design-system fidelity review

## Verdict

- **Recommendation:** REQUEST_CHANGES
- **Scope:** grade-3 hierarchy and legibility, 1280-class Chromebook fit, live-DOM implementation, and design-token fidelity for the student securities portfolio and trade routes.
- **Reviewed revision:** working tree at `0082717` plus uncommitted changes (no commit was created or modified by this review).

## Evidence inspected

- Current implementation and wiring:
  - `src/components/student/StudentSecuritiesPage.tsx:1-70`
  - `src/components/student/StudentStockMarketPage.tsx:1-82`
  - `src/components/student/StudentStockTrend.tsx:1-27`
  - `src/components/student/StudentStorePage.tsx:52-82`
  - `src/components/student/StudentHeader.tsx:20-37`
  - `src/components/student/StudentBalanceSummary.tsx:23-42`
- Current CSS and design contract:
  - `src/index.css:15053-15113`, `src/index.css:16657-16736`, `src/index.css:14313-14367`
  - `DESIGN.md:35-51`, `DESIGN.md:165-175`, `DESIGN.md:196-204`
- Supplied render evidence (inspected as untrusted artifacts):
  - `.omo/evidence/student-securities-portfolio-1280.png`, SHA-256 `7882a301816fee0513109c1a43fd23076fc5bed4f4aaffbc436bf2bafe967c05`
  - `.omo/evidence/student-securities-trade-1280.png`, SHA-256 `3e5b1eeea7aad9f87ae78bccde5157c2fc112b14300c870c62908bb50788996b`
  - Both files are JPEG/JFIF data despite their `.png` extension and are **1076×605**, not 1280×800.
  - `.omo/evidence/student-securities-qa/browser-action-log.md` independently records the same capture-backend size/format problem.
- Change set: full current `git diff` and changed-file list, including `DESIGN.md`, the three student securities components, `StudentStorePage.tsx`, `src/index.css`, `AuctionPage.tsx`, and `studentEconomy` implementation/tests.
- Static validation: `npm run lint` exited 0 (`tsc --noEmit`).

## What passed

- **Live component tree, not a visual substitute:** the securities overview and trade screen are rendered by real React sections/articles and are wired through `StudentStorePage` (`src/components/student/StudentStorePage.tsx:72-80`). `StudentStockTrend` and `StudentStockIcon` are shared primitives used by both screens (`src/components/student/StudentStockTrend.tsx:11-27`). The reviewed securities TSX files contain no `<img>`, and the scoped securities CSS contains no `background-image`/`url(...)` substitute.
- **Intended hierarchy in source:** portfolio state precedes owned holdings and the four-stock glance (`src/components/student/StudentSecuritiesPage.tsx:27-67`); the trade route uses a two-column four-card grid with the buy/sell action before the quieter disclosure (`src/index.css:15091-15113`). This is the right structural direction, but it is not enough to certify the requested 1280×800 visual result.

## Findings

### CRITICAL

None found. No screenshot/raster/background-image substitution was found in the reviewed securities implementation.

### HIGH

1. **The claimed 1280 Chromebook evidence is invalid, so 1280×800 fit and visual legibility are unverified.**
   - Evidence: both supplied files named `*-1280.png` are 1076×605 JPEG/JFIF files, not 1280×800 PNGs. The companion browser log also admits its captures were 1075×672 JPEG data.
   - Why this blocks approval: `DESIGN.md:199-204` defines 1280×800 as the authoritative viewport and requires no horizontal overflow with primary task actions visible. A smaller, differently proportioned, incorrectly typed capture cannot prove that contract. The trade capture also terminates in the middle of the second row, which is expected at its actual short height but is not evidence for the required 800px budget.
   - Required fix: recapture both routes from the current build at a declared **1280×800 CSS viewport**, preserve the actual PNG format, and include a DOM/scroll measurement showing viewport width/height, `scrollWidth === clientWidth`, and the relevant content-scroll container. Capture empty portfolio, trade grid, and one expanded-history state without performing balance-changing actions.

2. **The new securities surface is not token-driven; multiple raw one-off colors bypass the documented design system.**
   - File: `src/index.css:15059-15111`.
   - Evidence: the newly added design tokens cover only rise/fall (`DESIGN.md:50-51`; `src/index.css:11610-11613`), while the same feature directly declares `#193b30`, `rgba(255,255,255,...)`, `#f2eee5`, `#f1f3f2`, `#59665f`, `#f3f8f5`, `#34483f`, `#e3e9e5`, `#526159`, `#f6f7f5`, and `#64736b` in the portfolio summary, stock icon, flat trend, news, sell action, and history styles.
   - Why this blocks approval: the contract requires new colors to trace to semantic tokens; these literals make the student stock surface non-systemic and violate the requested token-fidelity check.
   - Required fix: define semantic stock-surface tokens in `DESIGN.md` and the token root (for summary, icon, neutral trend, news, sell state, and history divider/surface/text), then replace every raw color in the scoped securities rules with those tokens or an existing documented `--apple-*` token.

3. **Visual fidelity cannot be certified because no target/reference design artifact was supplied.**
   - Evidence: the supplied images are implementation evidence, not a target reference; `DESIGN.md` provides behavioral and token requirements but no visual target image for a pixel/fidelity comparison.
   - Required fix: attach the approved target/reference design, or explicitly designate the relevant `DESIGN.md` rules as the sole visual contract. Re-review against that declared contract after valid 1280×800 captures exist.

### MEDIUM

1. **The securities header visibly inherits student-facing labels below the design contract's 14px floor.**
   - File: `src/index.css:14542-14545`.
   - Evidence: `.student-balance-primary span` and `.student-balance-detail span` use `0.78rem` (12.48px at the default root). These labels appear in the securities header via `StudentBalanceSummary` (`src/components/student/StudentBalanceSummary.tsx:29-40`). `DESIGN.md:165` requires student-facing supporting text to be at least `0.875rem`/14px at the reference viewport.
   - Required fix: apply `var(--student-readable-text-min)` (or another documented 14px-or-larger type token) to those student header labels, then verify the one-row header remains legible at 1280×800.

### LOW

None.

## Approval blockers

1. Replace the invalid/mislabeled screenshot evidence with fresh, actual 1280×800 PNG captures and layout measurements.
2. Eliminate the scoped securities raw color values in favor of documented semantic tokens.
3. Provide or explicitly declare the visual target used for fidelity review.

The live-DOM/component requirement is satisfied, but the HIGH findings require **REQUEST_CHANGES**.
