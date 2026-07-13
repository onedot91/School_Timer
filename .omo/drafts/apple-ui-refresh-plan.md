---
slug: apple-ui-refresh-plan
status: awaiting-approval
intent: unclear
pending-action: update .omo/plans/apple-ui-refresh-plan.md for full-surface scope
approach: full-surface Apple Design refresh through scoped semantic tokens and sequential surface updates; no visible copy, behavior, or data changes
---

# Draft: apple-ui-refresh-plan

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
1 | Baseline and contracts captured | active | `.omo/evidence/task-1-apple-ui-refresh-plan.md`
2 | Shared Apple-style visual/accessibility foundation | active | `.omo/evidence/task-2-apple-ui-refresh-plan.json`
3 | Entry and root fallback surfaces aligned | active | `.omo/evidence/task-3-apple-ui-refresh-plan.png`
4 | Student auction states and confirmation aligned | active | `.omo/evidence/task-4-apple-ui-refresh-plan/`
5 | Timer home and utility chrome aligned | active | `.omo/evidence/task-5-apple-ui-refresh-plan/`
6 | Timer overlays/settings/draw aligned | active | `.omo/evidence/task-6-apple-ui-refresh-plan/`
7 | Full responsive and accessibility verification | active | `.omo/evidence/task-7-apple-ui-refresh-plan/`
8 | Standalone RandomDrawPage | active | `src/pages/RandomDrawPage.tsx:1840`
9 | Cross-app modal focus, dynamic type, and preference accessibility | active | `src/pages/AuctionPage.tsx:497`

## Open assumptions (announced defaults)
<!-- Intent is UNCLEAR: research resolves ambiguity, defaults are adopted (not asked), and each is surfaced in the plan's human TL;DR for veto. -->
whole-app | every maintained visual surface, including standalone RandomDrawPage | user clarified the scope as “전반적으로” | yes
Apple character | quiet macOS/iPadOS productivity hierarchy with existing warm green identity | suits classroom operations and preserves brand | yes
CSS scope | add/adjust semantic tokens and active selectors only | avoids 11k-line legacy cascade rewrite | yes
motion | instant press feedback, critically damped state transitions, bounce only for award/draw momentum | Apple motion causality without distraction | yes
accessibility | light-only; solid material fallback plus modal focus lifecycle, dynamic type, focus-visible, reduced transparency/contrast/forced-colors | Apple flexibility and current audit gaps | yes
testing | no new test framework; lint/build plus browser-driven state and viewport QA | repository has no committed tests | yes

## Findings (cited - path:lines)

- RootApp reaches EntrySelectPage, TimerPage, and AuctionPage only: `src/RootApp.tsx:116`, `src/RootApp.tsx:136`.
- Entry selector hides admin entry behind five title clicks: `src/pages/EntrySelectPage.tsx:15`.
- Auction refreshes shared state every three seconds and confirms before bid submission: `src/pages/AuctionPage.tsx:133`, `src/pages/AuctionPage.tsx:497`.
- CSS has multiple late override layers, so full cascade cleanup is unsafe: `src/index.css:5592`, `src/index.css:7626`, `src/index.css:7788`.
- TimerPage owns home, utility overlays, settings, embedded draw, and auction administration in one file: `src/pages/TimerPage.tsx:1566`, `src/pages/TimerPage.tsx:1791`, `src/pages/TimerPage.tsx:2666`, `src/pages/TimerPage.tsx:3328`.
- Real classroom balances and auction history must not be mutated by QA: `AGENTS.md:66`.
- Current CSS has five root token layers, 903 `!important` declarations, and multiple late overrides; implementation must use one final semantic theme seam instead of a full rewrite: `src/index.css:7788`, `src/index.css:8379`, `src/index.css:8478`.
- Dialog focus lifecycle is incomplete across Auction, Timer, and RandomDraw surfaces: `src/pages/AuctionPage.tsx:497`, `src/pages/TimerPage.tsx:9467`, `src/pages/RandomDrawPage.tsx:2195`.
- Existing repeated motion and reduced-preference coverage are inconsistent: `src/index.css:304`, `src/index.css:11419`, `src/index.css:11552`.

## Decisions (with rationale)

- Preserve all visible Korean copy; add no explanatory text. ARIA-only labels may be corrected when required.
- Keep existing character imagery and warm green accent; remove visual noise through hierarchy, not brand replacement.
- Treat root fallback, loading/error/empty/locked/selected/confirmation/submitting/success states as first-class visual states.
- Include standalone RandomDrawPage and keep it visually consistent with TimerPage's embedded draw surface without changing shared draw logic.
- Add no visible copy; accessibility-only names and semantics may be corrected.
- Standardize modal initial focus, focus trap, Escape close, trigger focus return, visible focus, 44px targets, and 200% text reflow.
- Sequentially edit TimerPage-owned surfaces because parallel changes in the same 10k-line file are conflict-prone.
- Use localStorage-only isolated fixtures for mutation QA; do not exercise live Supabase auction writes.

## Scope IN

- `src/index.css`, `src/RootApp.tsx`, `src/pages/EntrySelectPage.tsx`, `src/pages/TimerPage.tsx`, `src/pages/AuctionPage.tsx`, `src/pages/RandomDrawPage.tsx`, `src/components/AuctionRoom.tsx`.
- System typography, semantic colors, glass/material hierarchy, focus/press states, reduced preferences, responsive geometry, CJK layout.
- Existing modal semantics may be strengthened without changing workflow.

## Scope OUT (Must NOT have)

- Business logic, storage keys, Supabase payloads, currency/draw algorithms, new dependencies, dark mode, URL routing, new gestures, new visible copy, whole-file CSS rewrite.

## Open questions

None. Current approval is pending for the expanded full-surface scope.

## Approval gate
status: awaiting-approval for expanded scope; prior reachable-only Momus receipt is stale and must be rerun after plan update

## Review receipts

- Metis: completed; findings folded into canonical plan.
- Momus round 1: ITERATE; isolated fixture, F1-F4, references corrected.
- Momus round 2: ITERATE; deterministic backend, entry contracts, visual QA loop corrected.
- Momus round 3: ITERATE; exact storage/shortcut, bundled Playwright, PostgREST and request assertions corrected.
- Momus round 4: OKAY; unconditional approval.
- Independent Codex CLI attempt 1: blocked pending explicit authorization.
- Independent Codex CLI attempt 2 after explicit user authorization: permanently rejected by security policy because private workspace files cannot be exported to the external review service even with approval. No workaround attempted. Momus remains unconditional OKAY.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
