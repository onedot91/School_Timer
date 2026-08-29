# Failure exhibition visual/design-system re-gate

- Goal: `failure_exhibition_visual_regate`
- Recommendation: **APPROVE**
- Review mode: read-only final clone/design-system gate, 2026-08-29

## Evidence inspected

- Design contract: [DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:207), including the repaired `--failure-clip-width` / `--failure-clip-height` contract at lines 223–231.
- Live component tree: [StudentFailureRelay.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureRelay.tsx:151), [StudentFailureMessage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureMessage.tsx:45), and [studentFailureRelayMotion.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/studentFailureRelayMotion.ts:16).
- Token and material implementation: [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12633), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:14005), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:14114).
- Fresh live read-only browser inspection of `http://localhost:3002/#student-library`, at exact CSS `window.innerWidth === 1280`, `window.innerHeight === 800`, `documentElement.scrollWidth === 1280`, and `documentElement.scrollHeight === 800`. The initial six papers rendered tone attributes `0,5,4,3,2,1`; all six backgrounds were distinct. No child horizontal overflow was observed.
- Fresh runtime computed-style evidence: all six `.student-failure-relay-item::before` clips are `display: block`, `position: absolute`, `z-index: 5`, `width: 42.3984px`, and `height: 14.7188px`. The paper grid, wires, and rail occupy separate non-overlapping bounds.
- Supporting visual artifacts opened as supplemental evidence: [failure-exhibition-refined-1280x800-settled.png](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/failure-exhibition-refined-1280x800-settled.png), [failure-exhibition-refined-compose-1280x800.png](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/failure-exhibition-refined-compose-1280x800.png), and [failure-exhibition-visual-gate-clone-fidelity.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/failure-exhibition-visual-gate-clone-fidelity.md:1).

## Findings

### CRITICAL

None. The gallery is live React DOM: two reusable relay rows map live story data to `StudentFailureMessage` papers. The only per-paper image is a real profile `<img>`; no screenshot, rasterized feed, or CSS `background-image` substitutes for the wire, clip, paper, or text.

### HIGH

None. The prior blocker is repaired: `DESIGN.md` documents `--failure-clip-width` / `--failure-clip-height` as `2.65rem` / `.92rem`, the root token declarations have those exact values, and the live clip consumes those variables rather than raw dimensions.

### MEDIUM

None. The visible hierarchy is wire (`z-index: 0`) → clip (`z-index: 5`, non-interactive) → live paper/content (`z-index: 1` item), while the right rail is its own grid column outside the papers. Korean copy stays inside the measured paper/content bounds with no observed collision or horizontal overflow.

### LOW

None. Motion is purposefully layered: the outer relay wrapper translates on X only, the inner paper layer supplies the small rotational settle, and both settle at identity. The reduced-motion branch disables those transforms.

## Blockers

None.
