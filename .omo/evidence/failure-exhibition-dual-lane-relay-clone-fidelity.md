# Failure exhibition dual-lane relay — clone / visual fidelity gate

**Verdict:** REVISE (evidence-only)

**Recommendation:** REQUEST_CHANGES

## Scope and success criteria inspected

- Reference intent, not pixel target: `/private/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-296403fe-58bc-4fe4-aea5-c462a129d114.png`.
- Current relay states: rest, mid-transition, and settled. Expected sequence is upper `3,1,7 -> 5,3,1` and lower `4,2,8 -> 6,4,2`, with row Y positions unchanged.
- Required review: live component tree rather than an image substitute; token-driven wire/clip/paper hierarchy; aligned rows; unclipped Korean text; no settled overlap/scroll; and movement that reads as an incoming card per lane rather than a six-card page swap.

## Artifacts inspected

| Artifact | Direct inspection result |
| --- | --- |
| `tmp/failure-relay-dual-lane-rest-1075x672.jpg` | Valid 1075x672 JPEG; opened directly. Two three-card rows, two horizontal wires, and six centered clips are visible. |
| `tmp/failure-relay-dual-lane-mid-1075x672.jpg` | Valid 1075x672 JPEG; opened directly. It shows the post-move card identities but no observable in-flight translation. |
| `tmp/failure-relay-dual-lane-settled-1075x672.jpg` | Valid 1075x672 JPEG; opened directly. No crop, row overlap, or visible scrollbar. |
| Reference PNG | Valid 2158x1162 RGBA PNG; opened directly. It establishes the warm wall, suspended-paper, wire/clip, and right-rail intent only. |
| `src/components/student/StudentFailureRelay.tsx` | Reviewed current source and diff. |
| `src/components/student/studentFailureRelayMotion.ts` | Reviewed current source and diff. |
| `src/lib/failureExhibition.ts` | Reviewed current source and diff. |
| `src/index.css`, `DESIGN.md` | Reviewed current source and diff for hierarchy and tokens. |
| `src/lib/failureRelayCycle.test.ts`, `src/lib/failureRelayMotion.test.ts`, `src/lib/failureRelayPause.test.ts` | Executed as a targeted read-only verification: 12/12 passed. `npm run lint` also passed. |

The supplied captures postdate the reviewed source and design contract (`19:56:53–19:56:54` vs latest reviewed source/design edit `19:55:27`), so they are fresh for this revision. The task supplied no notepad path.

## Findings

### CRITICAL

None. The screen is rendered through live React components: `StudentFailureRelay` maps row data into keyed `motion.div` elements and renders `StudentFailureMessage`; no screenshot, raster, canvas, or CSS background image stands in for a card ([StudentFailureRelay.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureRelay.tsx:210)).

### HIGH

None found in the reviewed product. The changed physical design is represented by reusable failure-exhibition tokens (wire offset, clip dimensions, clip colors, paper edge) in `DESIGN.md` and root custom properties, rather than a raster approximation ([DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:207), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12630)).

### MEDIUM

1. **[evidence] The claimed mid-transition capture does not visibly prove an in-flight per-lane relay.** `failure-relay-dual-lane-mid-1075x672.jpg` has the same card placement as the settled frame (`5,3,1` / `6,4,2`); the only clearly visible state difference is focus around the right rail control. It therefore cannot visually rule out a discrete page replacement during the 280ms interval. Capture a frame around the middle of the actual X translation (for example ~140ms into the 280ms spring) showing retained cards translating horizontally and the two incoming cards entering at their row edges.

2. **[evidence] Primary viewport proof is unavailable.** Every supplied actual capture is a scaled `1075x672` JPEG, not a `1280x800` CSS viewport at 100% scale. Per the project viewport contract, this cannot approve no-clipping/no-overflow behavior at the authoritative viewport. Re-capture rest, genuine mid-transition, and settled states after proving `window.innerWidth === 1280`, `window.innerHeight === 800`, and browser preview scale `100%`.

### LOW

None.

## What is verified in the product

- **Layer hierarchy:** Each row owns a pseudo-element wire; each card puts the outer clip (`::before`), hook (`::after`), paper wrapper, and live message in deliberate z-order ([index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:13985), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:14007)). The actual captures visibly follow the wire → clip → white sheet → colored writing-field hierarchy.
- **Aligned dual lanes:** The rows use the same three-column grid and shared wire-offset token. Rest and settled captures keep both row baselines level; no card changes vertical lane ([index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:13985)).
- **Incoming-card semantics in implementation:** With eight or more stories, `getFailureRelayRows` derives two persistent lanes, and offset advance preserves two stories per row while introducing exactly one story per row ([failureExhibition.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/failureExhibition.ts:353), [failureExhibition.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/failureExhibition.ts:368)). The targeted test verifies the retained counts `[2,2]` and two new IDs. This matches rest `3,1,7` / `4,2,8` becoming settled `5,3,1` / `6,4,2`; it is not a six-card page data swap.
- **Horizontal, component-scoped motion:** The feed itself is never transformed. Per-row keyed cards use only `translateX` enter/exit variants, while the inner paper alone performs a small settling rotation ([StudentFailureRelay.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureRelay.tsx:210), [studentFailureRelayMotion.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/studentFailureRelayMotion.ts:33)). This is the correct structure for a relay rather than a page slide.
- **CJK and settled fit in supplied evidence:** All visible Korean labels, including `와이어 연결 확인`, `클립 접점을 같은 높이로 맞추기`, `두 행 순환 확인`, header text, and navigation labels, remain fully drawn with no one-character orphan, clip, or overlap. The settled capture has no horizontal/vertical scrollbar or cards crossing into the right rail.

## Blockers before approval

1. **[evidence]** A genuine in-flight motion frame must show the two lane-local incoming cards and retained-card X translation.
2. **[evidence]** Fresh 1280x800, 100% browser-scale captures for rest, genuine mid-transition, and settled states must prove the authoritative primary viewport.

No product-code change is requested by this review; the current blockers concern missing/insufficient visual evidence only.
