# Student header visual fidelity and CJK clone-fidelity review

- Date: 2026-08-13 (Asia/Seoul)
- Review mode: read-only visual and source inspection. No student control, navigation, or state-changing action was invoked.
- Goal: make the overview and store headers read as one system: same outer geometry/material, retained store back/title, a borderless/shadowless nested store balance, and safe Korean/CJK text.
- Verdict: **REVISE**
- Recommendation: **REQUEST_CHANGES**

## Success-criteria result

| Criterion | Result | Direct evidence |
| --- | --- | --- |
| Outer header geometry and material are shared | PASS | Both fresh 1280x720 captures show the 12px outer inset, 72px-tall rounded header treatment. The active compact rules use the shared `--student-header-height: 4.5rem` and `--student-card-radius` at `src/index.css:16517-16568`. |
| Store retains back control and title | PASS | The fresh store capture visibly retains the arrow/Home control and `고마 쓰기`; live DOM is rendered by `StudentHeader.tsx:20-37` and supplied by `StudentStorePage.tsx:55-68`. |
| Store nested balance is transparent, borderless, and shadowless | PASS | `src/index.css:14288-14296` explicitly sets `border: 0`, `background: transparent`, and `box-shadow: none`; the store capture has no card-in-card border or shadow. |
| Balance hierarchy feels like the reference system | FAIL | The reference store header puts each label and amount on one horizontal line; the fresh store capture stacks both `사용 가능 고마`/`150 고마` and `예약 고마`/`0 고마` into two rows. The shared grid primitive creates that stack at `src/index.css:14478-14515`, and the compact store override only changes padding at `src/index.css:16571-16583`. This is a visible hierarchy/spacing mismatch, not merely different content. |
| Korean/CJK precision in the supplied captures | PASS | `1번`, `사용 가능 고마`, `예약 고마`, `150 고마`, `0 고마`, `홈`, and `고마 쓰기` are fully visible in both fresh captures. No glyph splitting, clipping, overlap, or ellipsis was observed. |
| Live reusable implementation, not a screenshot substitute | PASS | The headers are live `StudentBalanceSummary` and `StudentHeader` DOM components (`StudentBalanceSummary.tsx:23-42`, `StudentHeader.tsx:20-37`); no header `background-image` or raster replacement is present. |
| Token-driven implementation for the changed header rules | FAIL | Newly active header rules still use undeclared one-off spacing/sizing values, including `.35rem`, `.75rem`, and `.82rem` in `src/index.css:14341-14362`, plus `3.25rem`, `.2rem`, `.35rem`, `8rem`, `30rem`, and `48vw` in `src/index.css:16571-16583`. `DESIGN.md` documents the overview compact tokens but not semantic tokens for these store-header balance dimensions. |

## Findings

### CRITICAL

None. I found no pasted screenshot, page-sized raster substitute, or missing reusable header primitive.

### HIGH

1. **Store balance hierarchy does not match the reference header.** The reference's available and reserved amounts are horizontally paired with their labels, whereas the current store capture renders two vertically stacked mini-columns. This makes the store header taller in perceived information density and breaks the requested shared-system rhythm.

   - Evidence: reference `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-98e087ca-992b-41aa-b2cd-56f8b37e1c91.png`; current `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-store-current.jpg`.
   - Code: `src/index.css:14478-14515`, `src/index.css:16571-16583`.
   - Required fix: give the store-header balance an explicit horizontal label/value layout at this Chromebook breakpoint while retaining its transparent, borderless, shadowless container.

2. **The changed header behavior is not fully token-driven.** Its key compact dimensions are embedded directly in CSS rather than declared as semantic design tokens and documented in `DESIGN.md`.

   - Code: `src/index.css:14341-14362`, `src/index.css:16571-16583`; token contract: `DESIGN.md:77-91`.
   - Required fix: define semantic tokens for compact header control spacing/type and store-header balance width, height, and internal padding; consume them in the rules above.

### MEDIUM

None. The supplied 1280x720 actual captures show no CJK clipping, text collision, or incorrect nested-balance material.

### LOW

1. Prior approvals were not accepted as proof. In particular, `.omo/evidence/student-header-consistency-gate-review.md` calls the result PASS, but it was reviewed only as untrusted context and does not change this direct comparison.

## Blockers

- Rework the store header balance into the reference's compact horizontal hierarchy at the reviewed Chromebook capture size, preserving the requested transparent/borderless/shadowless nesting.
- Replace the added header/balance magic dimensions with documented semantic design tokens.

## Evidence inspected

- Reference overview header: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-5e93199a-5c00-41ef-a94b-61c861c2c0b7.png` (2178x154 PNG; modified 18:33:24 +0900).
- Reference store header: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-98e087ca-992b-41aa-b2cd-56f8b37e1c91.png` (2194x196 PNG; modified 18:33:29 +0900).
- Fresh overview capture: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-overview-current.jpg` (1280x720 JPEG; modified 18:58:19 +0900).
- Fresh store capture: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-store-current.jpg` (1280x720 JPEG; modified 18:58:20 +0900).
- Live component/source artifacts: `src/components/student/StudentHeader.tsx`, `src/components/student/StudentBalanceSummary.tsx`, `src/components/student/StudentOverviewPage.tsx`, `src/components/student/StudentStorePage.tsx`, `src/index.css`, and `DESIGN.md`.
- Current full worktree diff and `git diff --check` (no whitespace errors).
- Untrusted prior evidence and notepad inspected for context only: `.omo/evidence/student-header-consistency-gate-review.md`, `.omo/evidence/student-store-header-balance-gate-review.md`, `.omo/ulw-loop/notepad.md`.

## Verification limits

This review is limited to the two supplied reference crops and the two supplied fresh 1280x720 captures. It does not certify responsive behavior below that size or perform state-mutating interaction testing.
