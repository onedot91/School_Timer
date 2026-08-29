# Wire/clip and six-tone visual fidelity gate

- Goal: `wire_clip_visual_gate`
- Verdict: **PASS**
- Review mode: read-only visual fidelity and CJK precision review, 2026-08-29

## Evidence inspected

- Illustrative prior-state references (opened directly; not treated as same-size pixel targets):
  - `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-551b41ac-37c5-49b1-8245-7cdd91b09855.png`
  - `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-1b423c74-e683-42e0-bd09-c91c135268ee.png`
- Fresh actual render, opened directly: `tmp/failure-exhibition-wire-clip-six-tones-1280x720-valid.png` — confirmed valid RGB PNG, `1280 x 720`.
- Live implementation and design contract:
  - `DESIGN.md:207-243`
  - `src/components/student/StudentFailureRelay.tsx:151-260`
  - `src/components/student/StudentFailureMessage.tsx:45-111`
  - `src/lib/failureStoryTone.ts:18-60`
  - `src/index.css:12620-12649, 13971-14056, 14133-14259`
- Runtime measurements supplied with the task: visible tones `[0,5,4,3,2,1]`; three subsequent relay windows remain six-paper sets; top wire `y=135.394`; each upper clip body spans `y=133.469..146.586`; hook `16 x 11.516px`; shaded trapezoid body `42.398 x 13.117px`.

## Findings

### CRITICAL

None. The exhibition is live, reusable React DOM: `StudentFailureRelay` maps each live story to `StudentFailureMessage` in two relay rows (`StudentFailureRelay.tsx:204-240`), while `StudentFailureMessage` renders actual text/buttons/profile elements (`StudentFailureMessage.tsx:45-111`). No screenshot, raster layer, or `background-image` substitutes for the wire, clip, cards, or CJK content.

### HIGH

None. Clip geometry, material, and colors use named failure tokens (`index.css:12633-12648`) and the visible-window tone allocator guarantees six distinct tones where a circular relay window would otherwise repeat a preferred tone (`failureStoryTone.ts:35-60`).

### MEDIUM

None. In the actual render, both wire rows read as rear layers and every card has a centered, shadowed, sand-metal clip whose body overlaps the wire and its paper edge. The provided Y measurements substantiate that attachment: the top wire intersects the body, not empty space. The small U-hook completes the over-wire reading rather than making the clip appear to float.

### LOW

None. All six colored writing fields are plainly distinguishable in one frame (butter, sky, lavender, coral, mint, aqua). Korean main and lesson copy has consistent left edges, natural two-line wrapping, no clipped glyphs, no isolated trailing syllables, and no collision with footer profiles or the side rail. The implementation supports that observed result through Korean-aware wrapping and two-line clamps (`index.css:14216-14259`).

## Tagged assessment

- [product] **Pass.** The requested wire/clip attachment is legible at the supplied actual viewport, material hierarchy is coherent (wire -> hook/body -> paper -> colored writing field), and every current six-card window uses six visibly distinct colors. No product blocker found.
- [evidence] The supplied fresh capture is `1280 x 720`, not the project’s required primary `1280 x 800`. This is a verification limitation only: it is not evidence of a product defect, and no source or layout observation identifies an 800px-specific failure. The automatic comparison to the `1982 x 1184` illustrative image is intentionally non-comparable (`dimensionsMatch: false`, similarity `0`) and was not used as a failure signal.

## Blockers

None.
