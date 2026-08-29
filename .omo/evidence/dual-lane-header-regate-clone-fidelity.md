# Dual-lane relay header re-gate — clone/fidelity review

## Scope and decision

- **Goal:** independently adjudicate the claim that the student header disappears during an in-flight dual-lane failure-story relay.
- **Success criteria:** the header remains a live, fixed DOM surface; the two relay lanes move horizontally; Korean text, wire, clip, and paper layers remain visually coherent.
- **Recommendation:** **APPROVE** for the narrow product claim: there is no header-disappearance defect in the supplied fresh mid-motion evidence.
- **Product verdict:** **PASS.**
- **Evidence verdict:** **LIMITED / NOT PRIMARY-VIEWPORT SIGN-OFF.** The header claim is supported, but neither supplied JPEG is exact `1280×800 @ 100%`; that is an **[evidence]** limitation only, not a product defect.

## Artifacts inspected

1. `tmp/failure-relay-dual-lane-header-mid-1075x672.jpg`
   - Directly opened; JPEG signature and `1075×672` dimensions verified.
   - Modified `2026-08-29 20:04:05`.
   - Shows the complete header at approximately `y=12–84`: 홈, 실패 자랑소, 실패의 의미는 한 판 더!, 책장으로 가기.
2. `tmp/failure-relay-dual-lane-true-mid-1075x672.jpg`
   - Directly opened; JPEG signature and `1075×672` dimensions verified.
   - Modified `2026-08-29 19:59:58`.
   - Begins at the gallery/wire region and omits the entire header region.
3. Supplied runtime observation, independently reconciled with source:
   - `.student-header` before/mid/after: `x=11.9945`, `y=11.9945`, `width=1051.6412`, `height=71.9997`, `opacity=1`, `display=flex`, `visibility=visible`, `transform=none`.
   - Text: `홈실패 자랑소실패의 의미는 한 판 더!책장으로 가기`.
4. Current source and changed-file diff:
   - `src/components/student/StudentFailureExhibitionPage.tsx:122-185`
   - `src/components/student/StudentFailureRelay.tsx:156-265`
   - `src/components/student/studentFailureRelayMotion.ts:1-48`
   - `src/components/student/studentFailureRelayState.ts:1-17`
   - `src/index.css:12620-12651`, `src/index.css:13824-14117`
   - `DESIGN.md:211-233`, `DESIGN.md:288-291`
5. Independent read-only visual reviewer result: PASS, agreeing that the `true-mid` header omission is a capture/frame issue and not product behavior.
6. Verification run:
   - `npm run lint` — passed.
   - Relay, overflow, tone, pause, and exhibition tests — 36 passed, 0 failed.

Relevant rendered source predates both captures: relay `19:54:57`, CSS `19:43:30`, design contract `19:55:27`; therefore neither capture is stale relative to the reviewed relay source.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. **[evidence] `true-mid` is not a whole-viewport page frame.**
   - Evidence: `tmp/failure-relay-dual-lane-true-mid-1075x672.jpg` begins with the first-row wire at the top boundary, while the fresh header frame has the header in that area. The common gallery content is displaced upward by roughly the header-height region; this conflicts with the unchanged DOM header rectangle and cannot be produced by a relay-item-only transform.
   - Source basis: `StudentHeader` is a sibling before the gallery (`StudentFailureExhibitionPage.tsx:123-142`); the animated elements are only each relay item and its inner paper (`StudentFailureRelay.tsx:210-245`, `studentFailureRelayMotion.ts:33-48`).
   - Adjudication: this is a capture/frame-scope defect, not a header or relay product defect. Re-capture at exact `1280×800 @ 100%` only if a primary-viewport visual-QA sign-off is required.

2. **[evidence] The provided captures are `1075×672`, not the project’s required primary `1280×800 @ 100%` viewport.**
   - This prevents using these JPEGs as final primary-viewport QA proof. It does not identify a defect in the implementation and must not be converted into a source-change request.

### LOW

None.

## Confirmed product qualities

- **Header is present and fixed:** The fresh mid-motion image visibly contains the full header. The supplied unchanged viewport rectangle, `display:flex`, `visibility:visible`, `opacity:1`, and `transform:none` are consistent with it. There is no hiding or transform path on `StudentHeader` in the relay component tree.
- **Real component/layer tree, not a screenshot substitute:** `StudentHeader`, `StudentFailureRelay`, two `.student-failure-feed-row` DOM rows, `motion.div` relay items, and nested paper motion render the scene. Targeted source contains no image/canvas/background-image use for this failure relay surface.
- **Token-driven layers:** the wire, clip, hook, paper edge, and story tones are custom properties (`src/index.css:12620-12651`) and are documented in `DESIGN.md:211-233`, rather than per-card hard-coded paint values.
- **Dual-lane motion:** each row has its own `AnimatePresence` and row container (`StudentFailureRelay.tsx:209-245`); enter/exit variants translate only on X (`studentFailureRelayMotion.ts:33-40`). The mid frame shows both rows concurrently moving horizontally. Boundary-card cropping is expected from row-level `overflow: clip` during the `105%` enter/exit transition, not text loss in settled content.
- **CJK:** the two center cards are sharp and naturally read as `두 행 순환 확인 7/8`, `한 번에 두 카드 보기 7/8`, `와이어 연결 확인 5/6`, and `클립 접점을 같은 높이로 맞추기 5/6`; no orphaned particle, broken syllable, tofu, or baseline clipping is visible. Partial strings at the left/right boundary belong to offscreen moving cards.
- **Wire/clip/paper alignment:** both rows use the same `--failure-wire-row-offset` (`src/index.css:13985-14005`); each card’s centered clip body and hook are positioned above the paper (`src/index.css:14015-14045`). In the inspected fresh mid frame the two horizontal wires remain continuous and every visible clip/hook meets its paper consistently.

## Blockers

- **Product blockers:** none.
- **Evidence-only follow-up (not required to resolve the header claim):** a full, uncropped `1280×800 @ 100%` rest/mid/settled sequence is required before declaring the entire surface’s primary viewport visual QA complete.
