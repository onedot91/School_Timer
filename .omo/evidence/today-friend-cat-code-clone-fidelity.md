# Today Friend Cat — Clone Fidelity Review

- **Recommendation:** REQUEST_CHANGES
- **Scope:** latest `오늘의 친구` artwork delivery through the reusable `StudentMissionCard`
- **Reviewed:** 2026-08-30 (Asia/Seoul)

## Findings

### CRITICAL

None.

### HIGH

1. **[evidence] Required 1280×800 visual evidence is stale against the current layout source.**
   - Required captures:
     - `tmp/visual-qa/today-friend-replacement/student-missions-cat-rest-1280x800.jpg`
     - `tmp/visual-qa/today-friend-replacement/student-missions-cat-hover-mid-1280x800.jpg`
     - `tmp/visual-qa/today-friend-replacement/student-missions-cat-hover-settled-1280x800.jpg`
   - All three files are valid 1280×800 JPEGs but were modified at **13:35:16 +0900**.
   - `src/index.css` was modified at **13:37:49 +0900**. The changed mission layout includes `grid-auto-rows: max-content` at [src/index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:17671), so the existing captures cannot demonstrate the latest rendered layout.
   - This violates the project’s required post-final-edit 1280×800 check. Re-capture the named rest, hover-mid, and hover-settled states after the current CSS, then validate them.

### MEDIUM

None.

### LOW

None.

## Confirmed product integrity

- The designated reference and deployed asset are byte-identical: SHA-256 `a5ab552d07d6208cba540d30cd85f941c068d032ef1535c1ed43c475d70b9c05`; both are valid 724×543 RGB PNGs. The inspected original user image is a matching 1448×1086 version of the same composition.
- The mission is rendered through the existing reusable component at [StudentMissionsPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx:249). It passes `illustrationSrc="/mission-illustrations/today-friend.png"` and supplies no `illustrationTitle` or caption, so no extra title overlay is rendered.
- [StudentMissionCard.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionCard.tsx:117) builds live DOM: an intrinsic 724×543 `<img>`, manual teacher-verification face, reward badge, and a native full-card `<button onClick>`. It is not a page screenshot or CSS background-image substitute.
- Shared card CSS supplies the 4:3 container and containment: [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:17818) and [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:17876). Shared token-driven card/focus/hover styles remain at [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:17764), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:18005), and [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:18014).
- Keyboard activation is preserved by the native button; [StudentMissionsPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx:255) wires it to `onOpenTodayFriend`, and [AuctionPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:1751) routes that callback to the dedicated view.
- The inspected (but stale) captures show the full 4:3 cat art with no crop/distortion, no duplicate title, retained manual-verification and `10고마` chrome, and no visible CJK overlap/clipping. The hover frames differ and match the shared hover behavior; they simply cannot certify the post-13:37 source.

## Validation performed

- Pixel diff of exact asset target vs deployed asset: dimensions match; `diffPixels: 0`; `diffRatio: 0`; `similarityScore: 100`; alpha intact.
- Focused tests: `node --import tsx --test src/lib/studentMissionPresentation.test.ts src/lib/todayFriend.test.ts` — 12/12 passed.
- Type check: `npm run lint` — passed.
- Independent read-only visual/design-system reviewers: one product PASS with the same freshness blocker, one visual PASS that confirmed dimensions and visual state content. The stale-evidence finding governs the gate.

## Blockers

1. Generate and validate fresh rest, hover-mid, and hover-settled 1280×800 captures after the current `src/index.css` revision.
