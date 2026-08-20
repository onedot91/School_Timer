# Number Baseball guide removal — clone-fidelity review

## Recommendation

APPROVE

## Scope and success criteria

Fresh read-only visual QA of the completed number-baseball state at four supplied viewports. The removed explanatory sentence must be absent; the retained title, completion/reward state, and strike/ball history chips must remain intact; there must be no CJK wrapping defect, clipping, overflow, or disproportionate blank gap. No exact-pixel reference was supplied, so review is against that stated visual contract and the current design-system implementation.

## Evidence inspected

- `.omo/evidence/number-baseball-guide-remove/number-baseball-guide-remove-1024.jpg` — JFIF JPEG, 860×672, modified after `StudentNumberBaseballPage.tsx`.
- `.omo/evidence/number-baseball-guide-remove/number-baseball-guide-remove-1280.jpg` — JFIF JPEG, 1075×672, modified after `StudentNumberBaseballPage.tsx`.
- `.omo/evidence/number-baseball-guide-remove/number-baseball-guide-remove-1366.jpg` — JFIF JPEG, 1147×672, modified after `StudentNumberBaseballPage.tsx`.
- `.omo/evidence/number-baseball-guide-remove/number-baseball-guide-remove-effective-512.jpg` — JFIF JPEG, 430×672, modified after `StudentNumberBaseballPage.tsx`.
- `src/components/student/StudentNumberBaseballPage.tsx:135-214`.
- `src/components/student/StudentNumberBaseballHistory.tsx:14-53`.
- `src/index.css:15199-15385`.
- `DESIGN.md:119-122,162,180`.

## Findings

### CRITICAL

None. The UI remains a live React component hierarchy: `StudentNumberBaseballPage` renders the header, finish state, and feedback, while `StudentNumberBaseballHistory` maps recorded attempts into live history rows. No raster asset or `background-image` substitutes for the interface.

### HIGH

None. The relevant baseball colors, sizing, surfaces, and motion derive from scoped custom properties and documented tokens; the retained history is a reusable component rather than a screenshot-like one-off.

### MEDIUM

None. The exact deleted sentence (`S는 자리까지 정답, B는 숫자만 정답, OUT은 없는 숫자예요.`) has no match in `src/`. The retained title is the only guide text at `StudentNumberBaseballPage.tsx:144-146` and displays on one line in all four fresh captures, including effective 512 px.

### LOW

None. Direct inspection found no clipped glyphs, tofu, baseline defects, semantic CJK breaks, horizontal scrollbar, or accidental empty gap. The 512 px capture uses the intended vertical page flow; its lower history remains reachable rather than being horizontally compressed.

## Verified preservation

- Completion and reward remain visible: `정답을 맞혔어요!`, `정답은 614 · +15 고마`, and `보상 지급을 완료했어요.`.
- Existing completed-attempt history remains intact: `1B 볼`, `2S 스트라이크`, `1S 스트라이크`, and `3S 스트라이크` are visible at the desktop captures, with the narrow capture retaining the same live history progression.
- The layout remains balanced after deletion: at desktop widths, the guide/finish/reward cluster is visually centered in the left panel; at effective 512 px, it stays compact in the single-column panel without a new excess blank region.

## Blockers

None.
