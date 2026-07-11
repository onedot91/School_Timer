---
slug: apple-ui-refresh-plan
status: external-review-policy-blocked
intent: unclear
pending-action: write .omo/plans/apple-ui-refresh-plan.md
approach: reachable-screen Apple Design refresh through scoped semantic tokens and sequential surface updates; no behavior/data changes
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
8 | Standalone unreachable RandomDrawPage | deferred | `src/RootApp.tsx:136`

## Open assumptions (announced defaults)
<!-- Intent is UNCLEAR: research resolves ambiguity, defaults are adopted (not asked), and each is surfaced in the plan's human TL;DR for veto. -->
whole-app | only screens reachable from RootApp | avoids redesigning disconnected duplicate implementation | yes
Apple character | quiet macOS/iPadOS productivity hierarchy with existing warm green identity | suits classroom operations and preserves brand | yes
CSS scope | add/adjust semantic tokens and active selectors only | avoids 11k-line legacy cascade rewrite | yes
motion | instant press feedback, critically damped state transitions, bounce only for award/draw momentum | Apple motion causality without distraction | yes
accessibility | light-only; solid fallback for unsupported transparency preferences; preserve and improve modal semantics | current product has no dark mode contract | yes
testing | no new test framework; lint/build plus browser-driven state and viewport QA | repository has no committed tests | yes

## Findings (cited - path:lines)

- RootApp reaches EntrySelectPage, TimerPage, and AuctionPage only: `src/RootApp.tsx:116`, `src/RootApp.tsx:136`.
- Entry selector hides admin entry behind five title clicks: `src/pages/EntrySelectPage.tsx:15`.
- Auction refreshes shared state every three seconds and confirms before bid submission: `src/pages/AuctionPage.tsx:133`, `src/pages/AuctionPage.tsx:497`.
- CSS has multiple late override layers, so full cascade cleanup is unsafe: `src/index.css:5592`, `src/index.css:7626`, `src/index.css:7788`.
- TimerPage owns home, utility overlays, settings, embedded draw, and auction administration in one file: `src/pages/TimerPage.tsx:1566`, `src/pages/TimerPage.tsx:1791`, `src/pages/TimerPage.tsx:2666`, `src/pages/TimerPage.tsx:3328`.
- Real classroom balances and auction history must not be mutated by QA: `AGENTS.md:66`.

## Decisions (with rationale)

- Preserve all visible Korean copy; add no explanatory text. ARIA-only labels may be corrected when required.
- Keep existing character imagery and warm green accent; remove visual noise through hierarchy, not brand replacement.
- Treat root fallback, loading/error/empty/locked/selected/confirmation/submitting/success states as first-class visual states.
- Sequentially edit TimerPage-owned surfaces because parallel changes in the same 10k-line file are conflict-prone.
- Use localStorage-only isolated fixtures for mutation QA; do not exercise live Supabase auction writes.

## Scope IN

- `src/index.css`, `src/RootApp.tsx`, `src/pages/EntrySelectPage.tsx`, `src/pages/TimerPage.tsx`, `src/pages/AuctionPage.tsx`, `src/components/AuctionRoom.tsx`.
- System typography, semantic colors, glass/material hierarchy, focus/press states, reduced preferences, responsive geometry, CJK layout.
- Existing modal semantics may be strengthened without changing workflow.

## Scope OUT (Must NOT have)

- `src/pages/RandomDrawPage.tsx`, business logic, storage keys, Supabase payloads, currency/draw algorithms, new dependencies, dark mode, URL routing, new gestures, new visible copy, whole-file CSS rewrite.

## Open questions

None. User approved the derived direction with “진행해”.

## Approval gate
status: planning-approved; Momus OKAY; independent Codex CLI review blocked pending explicit permission to transmit the plan and AGENTS.md to OpenAI Codex service

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
