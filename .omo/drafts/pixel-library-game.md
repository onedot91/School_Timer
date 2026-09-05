---
slug: pixel-library-game
status: awaiting-approval
intent: clear
review_required: false
pending-action: write .omo/plans/pixel-library-game.md
approach: Build a solo 2D side-scrolling pixel library inside the existing student route, reuse the active Goma character and current shared studentLife snapshot, persist only book metadata plus a stable shelf/row/slot placement, and use an atomic server-side JSONB placement RPC so shared shelves cannot double-book a slot without Realtime subscriptions or a new table.
---

# Draft: pixel-library-game

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
game-scene | 1280x800 side-scrolling pixel library with camera, collision, movement, and accessible touch/keyboard controls | active | src/components/student/StudentLibraryPage.tsx; src/components/student/StudentPetStage.tsx; DESIGN.md
player-avatar | active Goma skin acts as the student's controllable solo avatar with walk/idle/carry/place feedback | active | src/lib/studentEconomy.ts; public/goma-skins/
shared-shelves | all students see one persistent shelf layout and can inspect every placed book | active | src/lib/studentLife.ts; src/pages/AuctionPage.tsx
book-placement | proximity interaction selects an empty shelf slot and atomically places a carried book | active | src/lib/bookStackMission.ts; src/lib/supabaseSettings.ts; api/shared-settings.ts
persistence-security | server validates ownership, input, slot uniqueness, and retries; local mock remains deterministic | active | api/shared-settings.ts; supabase/app_settings.sql; tests/api/shared-settings.test.ts
visual-assets-qa | original high-quality pixel library assets, responsive/accessibility states, and real-browser gameplay evidence | active | DESIGN.md; public/; src/index.css

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
world topology | one wide library hall with multiple shelves, no rooms or procedural world | delivers the requested gameplay without unnecessary navigation complexity | yes
multiplayer | no realtime presence, position writes, chat, or other-student avatars | user requires Supabase free-plan discipline | yes
sharing cadence | books appear for classmates on the existing settings refresh/re-entry path | avoids new polling or subscriptions | yes
avatar animation | reuse the selected Goma skin with CSS transform/opacity walk, carry, and placement states | preserves each student's own character without generating a sprite sheet for every skin | yes
art direction | original warm classroom pixel art inspired by side-view sandbox depth, never copied game assets | preserves originality and project identity | yes
audio | no required audio in the first complete implementation; core gameplay cannot depend on it | avoids new media/privacy/autoplay complexity | yes
test strategy | tests-after for domain/API contracts plus agent-executed browser gameplay QA | subtle persistence boundary needs regression coverage; UI behavior needs real-surface evidence | yes

## Findings (cited - path:lines)
Current books already carry studentNumber/title/author/pageCount and live in shared studentLife, but have no shelf position: src/lib/studentLife.ts:23-30,140-162,251-259.
The current student page filters to getStudentBooks(studentNumber) and renders only the student's stack: src/pages/AuctionPage.tsx:689,767-809,2135-2141; src/components/student/StudentLibraryPage.tsx:19-100.
The shared-settings client retries CAS writes, but slot uniqueness still requires a server-side occupancy check on each retry: src/lib/supabaseSettings.ts:152-223; api/shared-settings.ts:300-366.
StudentLife is currently a broad mutable field in student projection; the new placement boundary must prevent alteration of another student's books: api/shared-settings.ts:29-63,106-170,186-228.
The project already has active Goma skins, normalized character positioning, keyboard movement, and CSS walk-motion precedents: src/lib/studentEconomy.ts; src/lib/studentPet.ts; src/components/student/StudentPetStage.tsx; src/pages/TimerPage.tsx.
The design contract requires a 1280x800 first-screen fit, no document overflow, 44px controls, keyboard access, reduced motion, and text-zoom safety: DESIGN.md.
The worktree already contains unrelated modified source files; execution must preserve them and avoid broad rewrites: git status --short (planning session).

## Decisions (with rationale)
The library is shared by students 1-23, while traversal is solo and client-local.
Only book creation/placement and permanent shelf state are persisted; movement/camera state is not.
The existing library route is upgraded instead of creating a parallel store-like destination.
Books are addressed by semantic shelf/row/slot identifiers, not viewport coordinates, so layout remains stable across displays.
The selected Goma skin remains the student's identity; movement feedback uses composited transforms rather than layout animation.
No live balances, rewards, or production student records may be used for QA.

## Scope IN
Original pixel-art library world, player movement/camera/collision, accessible controls, proximity interaction, carried-book flow, shelf slot selection, shared book inspection, stable persistence, slot conflict recovery, local/mock fallback, migration/normalization, tests, build, and real-browser QA.

## Scope OUT (Must NOT have)
Supabase Realtime, live player presence, chat, other-student avatars, position telemetry, procedural terrain, combat, copied Terraria assets, new game-engine dependency, new polling loop, or production-data QA.

## Open questions
Persistence owner decision: use one atomic security-definer RPC to update the existing app_settings.studentLife JSONB (recommended: no new table and minimal free-plan footprint), or add a dedicated library placement table with a unique slot constraint (cleaner relational model but a larger migration and more rows).

## Approval gate
status: awaiting-approval
Brief ready. Await the user's choice on persistence and explicit approval to write .omo/plans/pixel-library-game.md. Approval authorizes plan creation only; implementation starts later through a goal/start-work execution.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
