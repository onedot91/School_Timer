# Number Baseball Final — Clone / Design-System Fidelity Review

**Verdict:** APPROVE  
**Reviewer:** independent read-only fidelity pass  
**Reviewed:** 2026-08-20

## Scope and reference intent

Reviewed the final student number-baseball history board against the active requirements: chronological nine attempts; quiet reward bands for `+15`, `+10`, and `+5 고마`; no visible `1~5회`/`6~7회`/`8~9회` labels; clear attempt → guess → result hierarchy; dashed future states; an accessible restrained current-next state; no thick tier boundary; and student-safe responsive rendering.

## Evidence inspected

- Fresh rendered captures, all later than the reviewed source files and valid JPEGs:
  - `.omo/evidence/number-baseball-final/history-1024.jpg` — 860×672 raster (84% browser rendering of 1024 CSS px)
  - `.omo/evidence/number-baseball-final/history-1280.jpg` — 1075×672 raster (84% browser rendering of 1280 CSS px)
  - `.omo/evidence/number-baseball-final/history-1366.jpg` — 1147×672 raster (84% browser rendering of 1366 CSS px)
  - `.omo/evidence/number-baseball-final/history-effective-512.jpg` — 430×336 raster (84% browser rendering of effective 512 CSS px)
- Live component tree and logic:
  - `src/components/student/StudentNumberBaseballHistory.tsx:14-67`
  - `src/components/student/StudentNumberBaseballResult.tsx:10-29`
  - `src/lib/numberBaseball.ts:67-83`
- Token and responsive/accessibility styling:
  - `src/index.css:15310-15438`
  - `src/index.css:16786-16872`
- Product contract: `DESIGN.md:180`

## Findings

### CRITICAL

None. The board is rendered by a real semantic React DOM tree (`section`, `header`, `ol`, `li`, `strong`, result spans); it does not use screenshots, raster assets, or background-image substitutions.

### HIGH

None. The hierarchy, reward allocation, chronological order, fixed nine slots, and OUT logic are connected to shared game data rather than mocked display data. `getNumberBaseballResultDisplays` emits `OUT` only for zero strikes and zero balls (`src/lib/numberBaseball.ts:75-82`).

### MEDIUM

None. The visible range headings have been removed. Only compact reward pills remain (`StudentNumberBaseballHistory.tsx:24-33`), while the full ranges are preserved in accessible section names (`:25-29`). The former tier border and 4px vertical line are absent; the quiet separation uses tier-token surfaces instead (`src/index.css:15318-15340`).

### LOW

None. CJK copy is intact in all available captures; no clipping, orphaned Korean particles, horizontal overflow, or duplicated labels was observed. The responsive layouts retain the full desktop board at 1024/1280/1366, and the effective-512 capture stacks the surface without a horizontal crop.

## What passed

- **Design system:** semantic colors, surfaces, radii, typography, shadows, spacing, and motion use existing `--apple-*` and `--student-baseball-*` tokens. The only tier-specific variation is a scoped custom-property assignment (`src/index.css:15327-15329`), not one-off literal color styling.
- **Hierarchy and density:** cards read as attempt number → large tabular three-digit guess → large S/B/OUT badge. S, B, and OUT remain distinguishable through solid, double, and dashed borders as well as labels and color (`src/index.css:15371-15380`).
- **Reward boundaries:** the three bands are quiet tonal surfaces with compact reward labels and no heavy vertical separator; the 5/7 transitions are retained structurally and visually (`src/index.css:15311-15345`).
- **Future/current states:** every slot through 9 is live DOM. Future slots are dashed; only the next available slot has a restrained tonal/inset current state, `aria-current="step"`, and the visible `다음 입력` label (`StudentNumberBaseballHistory.tsx:37-50`, `src/index.css:15360-15366`). Terminal games intentionally have no next slot.
- **Responsive and preferences:** the fresh 1024/1280/1366 captures fit the 800px task-height budget without an inner history scrollbar. The CSS has explicit narrower grid rules (`src/index.css:15408-15438`), reduced-motion suppression (`:16786-16805`), and forced-colors differentiation for result, future, and current states (`:16827-16872`).

## Blockers

None.

## Recommendation

**APPROVE.** The final right-side history board is a live, token-driven implementation that satisfies the active visual and accessibility contract. The later explicit instruction to remove visible range headings is honored.
