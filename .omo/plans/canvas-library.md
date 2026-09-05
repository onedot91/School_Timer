# canvas-library - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 학생이 직접 걸어 등록대에서 책을 받고 원하는 서가에 꽂는 2D 탑다운 공유 도서관. 100권의 위치와 정보를 학생들이 함께 읽는다.

**Why this approach:** 모든 공간과 캐릭터를 같은 Canvas 픽셀 규칙으로 그린다. 작은 실제 플레이 공간의 조화와 조작감을 먼저 검증하고, 이후 공간 확장과 공유 저장을 연결한다.

**What it will NOT do:** 생성 이미지, 실시간 멀티플레이, 긴 복도, 큰 웹 헤더를 추가하지 않는다. 기존 기록이나 다른 작업을 삭제하지 않는다.

**Effort:** Large
**Risk:** High - 시각적 통일성과 기존 공용 설정의 학생 권한·동시 저장 경계를 모두 검증해야 한다.
**Decisions to sanity-check:** 추가 엔진 없이 Canvas 2D, 따뜻한 나무와 청록 그림자, 고정 탑다운 시점, 기존 공용 설정의 서버 조건부 저장 활용.

사용자는 계획 후 실행을 명시적으로 승인했다. 새 의존성·DB 마이그레이션·운영 배포·커밋·푸시는 별도 승인 경계다.

---

> TL;DR (machine): Large, High; 7 implementation tasks + 4 final checks; direct workspace delivery, no commit.

## Scope
### Must have
- Students 1..23; local controllable character; registration desk → carry book → choose empty shelf slot → inspect persistent book information; shared 100-slot capacity, not a 100-record destructive history cap.
- Native Canvas 2D scene. Shared 1-logical-pixel grid, upper-left lighting, limited four-step material ramps, code-authored sprites/tiles, contact shadows, y-sorted furniture and character, directional walking/carrying animation. No restored discarded code.
- Initially a compact 624×376 logical-pixel room, integer scaling when space permits (1248×752 at authoritative 1280×800), letterboxing and bounded viewport; whole room visible. Registration left, central browsing, reading alcove right. No camera/physics engine dependency.
- The library route ONLY uses an immersive fixed inset12px surface (1256×776 available), no StudentHeader or inherited task header/gap. Canvas1248×752 centered; small44px back/status controls in reserved scene perimeter, never over furniture. Other routes retain existing shell. Final integrated-route QA must assert this actual budget rather than only fixture geometry.
- Small-room fixture initially has two differently proportioned shelves and a reading table, registration desk, windows, lamps and a distinct code-drawn bear character with student-specific scarf. Full version adds varied shelves up to exactly 100 stable slots without changing pixel density.
- Arrow/WASD movement with normalized diagonals and collision; E/Enter interaction; real pointer controls and spatial hotspot access. Semantic DOM forms/dialogs overlay the Canvas only when needed, minimum 44px controls, 14px supporting Korean text. Slots expose keyboard-selectable names and book metadata, not Canvas-only inaccessible targets.
- New book registration creates a carry draft, not a saved book/reward. Successful placement performs the authoritative commit. Existing books remain accessible; own unplaced records can be carried without duplicate registration/reward.
- No movement traffic. Shared refresh on entry, foreground/coalesced existing refresh, explicit retry/refresh, and commit; no realtime subscriptions or new polling loop.
- Pointer model: compact44px directional controls in reserved lower edge space (pointerdown/up/cancel, no hidden continuous motion); clicking a shelf does not teleport or remotely place, it only interacts when in range. Keyboard arrows/WASD move; E opens nearby object. Nearby shelf opens one DOM slot picker dialog for that shelf only, with <=20 buttons named `빈자리 N` or book title; CSS grid follows shelf rows/columns, arrow keys rove, Tab stays inside modal, Enter selects, Escape closes and returns scene focus. Occupied slot opens details; carrying + empty slot confirms placement. No relocation of already placed books in scope.
- User refinement during task6: the slot picker is an enlarged bookcase, not a grid of card-like buttons. Reuse scene palette, pixel-step timber frame, continuous horizontal planks and dark recesses; occupied positions render book silhouettes, empty positions quiet placement outlines. Preserve exact shelf rows/columns/variant, >=44px semantic targets and accessible labels. Selection highlights the actual chosen book position; metadata appears in one contextual caption, not repeated on every cell. Pending/error/full states and keyboard behavior remain intact. No generated image or canvas screenshot substitute.
- Additional user refinement: all books placed in shelves show their narrow SPINES, not front covers, in BOTH Canvas world and enlarged shelf modal. Keep a shared deterministic color/thickness/binding-band rule across the two surfaces; no separate generated assets. Book title/author remain readable in contextual selection/details. Decorative reading-table books may retain a cover because they are lying on the table, not shelved student books.
- Latest user override: remove the visible on-screen directional arrow pad. Keyboard arrows/WASD remain the movement controls; contextual interaction and nearby Canvas clicks remain. This supersedes the earlier pointer-pad display requirement and its pad-specific hold/cancel acceptance tests. Do not replace it with another persistent movement toolbar.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- No image generation, external asset downloads, new dependency, restored old pixel-library files, SQL migration, operational writes, deployment, commit/push/PR, destructive cleanup of user records.
- No modifying teacher/other feature presentation or removing existing weekly book mission semantics.
- No fixed fake books disguised as shared data, telemetry/set-position hooks as substitutes for actual keyboard play, screenshot backgrounds, global theme takeover, static demo presented as full delivery.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD with existing Node/tsx for world and persistence boundaries; baseline characterization before changing current behavior; failing browser proof for absent scene. No extra dependency.
- Evidence: `.omo/evidence/canvas-library/` with task-specific logs, PNGs, QA scripts and receipts. Real browser first through CUA; bundled Playwright Chrome only for capabilities CUA lacks. Root independently plays final changes.
- Verified fallback runtime exists at `/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`; it is preinstalled outside project, not a new dependency. CUA advanced browser API supports viewport override and read-only DOM evaluation; current IAB compositor can crop the resulting override screenshot. Use CUA for normal inspection, bundled runtime for exact PNG capture and held-key real blur (not exposed by current CUA controls). No OS-global keystrokes. Block /api/** and every nonlocal request in isolated visual fixtures because Vite proxies /api to production.
- Every task records PIN/RED/GREEN/SURFACE, applicable adversarial classes, cleanup of owned browsers/PIDs/ports. Test results alone do not satisfy visual tasks. Two independent visual reviewers inspect whole-scene fresh PNGs, functional states and CJK.
- Run `npm run lint`, `npm test`, `npm run build`, `git diff --check`; final 1280×800 screenshot and actual movement/register/place/read sequence. Test held-key blur, modal freeze/focus return, invalid input, repeated interaction, reduced motion, 200% text stress, conflict, failed save/retry, read-only rejection, two isolated students, no network movement.
- Backend tests use isolated fake PostgREST and signed fake sessions only. Conditional write success must be independently supported by fake-state before/after snapshots, not just response status. No production database calls.

## Execution strategy
### Parallel execution waves
User sequence takes precedence: Wave A tasks 1–3 (small room, then visual gate), Wave B task 4 (100 slots only after gate), Wave C tasks 5–7 (shared boundaries then integration), final F1–F4. Atomic independent lanes within task 2 run concurrently; renderer/UI share a written world interface. Server work does not start before task 4 passes.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | plan review | 2 | none; contract first |
| 2 | 1 | 3 | world/physics and renderer; UI after shared interface |
| 3 | 2 | 4 | independent functional and visual reviewers |
| 4 | 3 | 5,6 | tests and visual review |
| 5 | 4 | 6,7 | independent security test design |
| 6 | 5 | 7 | client adapter and server test runner in distinct files |
| 7 | 6 | F1–F4 | final test/build and browser checks |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Lock the scoped art and interaction contract
  What to do: append a Canvas-library scoped exception to DESIGN.md with geometry, palette/material ramps, rendering layers, sprite silhouette, shelf variants, contextual HUD/dialog states, input and accessibility rules. Record actual old bookshelf baseline at 1280×800 using isolated current-source fixture. No product component yet.
  Interface contract: world file owns exported `LibraryPoint`, `LibraryRect`, `LibraryShelf`, `LibrarySlot`, `LibraryRoom`, `LibraryPlayer`, `LibraryBookDraft`, `LibraryPlacedBook`, `createSmallLibraryRoom`, `createLibraryPlayer`, `stepLibraryPlayer`, `getNearbyLibraryTarget`, and `placeLibraryDraft`. World operations are pure and contain no DOM/network. Renderer owns `createLibraryRenderer(canvas, room)` returning draw(scene) and dispose(), static tile/sprite cache, token palette, no input/RAF. Game component owns RAF timing, keyboard/pointer events, responsive Canvas display/logical mapping, modal state, local fixture adapter. Renderer rounds draw coordinates; world retains subpixel movement. Stage integer scale is based on CSS space, not browser DPR; intrinsic624×376 pixel buffer and image-rendering:pixelated preserve physical pixel grid.
  Exact shared draw state: world also exports `LibraryTarget` and `LibraryScene = {player:LibraryPlayer; placedBooks:readonly LibraryPlacedBook[]; carriedDraft:LibraryBookDraft|null; nearbyTarget:LibraryTarget|null; selectedSlotId:number|null; timeMs:number; reducedMotion:boolean}`. Renderer contract `createLibraryRenderer(canvas:HTMLCanvasElement,room:LibraryRoom):{draw:(scene:LibraryScene)=>void;dispose:()=>void}`. World worker publishes all nested types in one interface before renderer/UI starts; no parallel divergent interfaces.
  Parallelization: A; blocked by written plan review; blocks 2.
  References: DESIGN.md sections 2,4,5,7; src/components/student/StudentLibraryPage.tsx:1-129; package.json; src/main.tsx.
  Acceptance: contract names all scene primitives and states, user prohibition on imagegen retained, no other feature contract removed. Baseline proves existing book form and stack using synthetic book metadata only; new playable Canvas absent is RED.
  QA: browser `page.setViewportSize({width:1280,height:800})`, open isolated fixture and capture baseline; assert existing form and no Canvas game. Review contract against user screenshot's coherence rather than dungeon art cloning. Evidence task-1-contract.md + baseline.png. Commit: N.
- [x] 2. Build a small playable room using isolated temporary data
  What to do: fresh src/lib/canvasLibraryWorld.ts and .test.ts for geometry, collisions, range and draft/placement; src/components/student/library/CanvasLibraryRenderer.ts for code pixels and cached static tiles; CanvasLibraryGame.tsx plus appended `.student-canvas-library-*` rules in src/index.css for input and small semantic overlays (nested components AGENTS prohibits one-off component CSS files). Use .omo/evidence/canvas-library/play.html + play.tsx importing real components only as isolated mount. Existing route/data untouched until task6 coordinated cutover.
  Parallelization: A; blocked by 1; separate world and renderer lanes after explicit types; UI owns controller/CSS only.
  References: task 1 contract; StudentConfirmDialog.tsx and modal helpers for focus behavior; studentLife.ts StudentBook for eventual adapter boundary, not persistence yet.
  Acceptance: exact one-book loop playable; common textures/lighting; movement normalized, collision substeps prevent tunneling, no network/storage; 4-way walk/carry; nonduplicating E input; modal/blur pause. Decorative reading books are clearly props, never counted as student books.
  QA: failing world unit imports then real assertions for collision, diagonal speed, near/far interaction, repeated placement; `node --import tsx --test src/lib/canvasLibraryWorld.test.ts`. Browser keyboard walks to desk; `page.getByRole('textbox',{name:'책 제목'}).fill('달빛 우체국')`, fill author/pages, carry, walk to shelf, pick slot, inspect title. Escape cancel retains existing placed book. Evidence task-2-*; cleanup owned test server/browser. Commit: N.
- [x] 3. Pass the small-room whole-scene and controls gate
  What to do: root actual play plus two independent visual/functional reviewers; fix any flatness, disconnected scale, repetitive tiles, unreadable book, overlap or confusing interaction before expansion.
  Parallelization: A; blocked by 2; blocks 4 unconditionally.
  References: task 1 DESIGN contract, task 2 source/fixture.
  Acceptance: fresh 1280×800 empty/carry/select/placed/reading PNGs; document overflow zero; all intended targets >=44 CSS px; input modal traps/returns focus; held-key real window blur and re-focus do not resume movement; reduced-motion equivalent. No room clipping or props floating against backdrop. Review verdicts must be confirmed; root independently inspects images.
  QA: CUA actual keyboard play; Playwright `page.keyboard.down('d')`, real other-tab focus, compare observed position before/after, release key; dialog typing does not move player. 200% text stress retains reachable close/submit actions. Evidence task-3-qa.json/PNGs/reviewer reports. Commit: N.
- [x] 4. Expand the approved space to 100 reachable book positions
  What to do: extend fresh world layout with varied compact/wide/tall/endcap shelves under same rules; exactly 100 stable unique slots; connected registration/shelves/reading routes. Keep all slots reachable and tied to real shelf geometry. No persistence integration yet.
  Parallelization: B; blocked by 3.
  References: canvasLibraryWorld.ts/.test.ts; CanvasLibraryRenderer.ts; DESIGN.md Canvas section.
  Acceptance: graph-based reachability from spawn to every interaction point, no furniture intersection, 100 unique slots; actual empty and full-room screenshots retain legible individual book silhouettes and safe paths. 101st placement rejects without removing any book.
  QA: unit flood-fill navigation assertions + full100 fixture; real `page.click` or keyboard approach to boundary shelves and inspect first/last occupied position. Evidence task-4-* including full100.png and capacity conflict receipt. Commit: N.
- [x] 5. Add non-destructive placement rules and guard the existing settings boundary
  What to do: use additive `StudentBook.librarySlot?: number` integer0..99; absent means unplaced. First valid slot claimant in normalized oldest-first array retains slot; later duplicate/invalid slot becomes unplaced without deleting book. No relocation/removal command. Keep all valid existing book records/order; remove book-only automatic600 truncation so adding to a600-record legacy fixture cannot evict history. Do not change letters/failure retention. Existing1MB settings guard rejects oversized new writes without deleting records. Isolate pure command validation/transform in src/lib/canvasLibraryPlacement.ts with tests; handler/CAS is task6.
  Exact command contract: PUT `/api/shared-settings`, body `{action:'placeLibraryBook',requestId:string,slotId:number,book:{kind:'new',title:string,author:string,pageCount:number}|{kind:'existing',bookId:string}}`; requestId UUID length36, slot0..99, title1..50, author1..30, integer pages1..5000. Session determines student (no payload identity). New record ID `library:${studentNumber}:${requestId}`, createdAt from server. Existing book must be owned/unplaced; already placed same slot returns same success, different slot rejects. New id retry requires same metadata/slot, otherwise request reuse rejects. Result200 `{book:StudentBook,updatedAt:string,value:studentScopedAuthoritativeSnapshot}`. Errors400 INVALID_LIBRARY_COMMAND,403 LIBRARY_BOOK_FORBIDDEN,409 LIBRARY_SLOT_OCCUPIED / LIBRARY_FULL / LIBRARY_BOOK_ALREADY_PLACED / SHARED_SETTINGS_CONFLICT,502 LIBRARY_SAVE_FAILED; client adapter returns typed success/error and never treats readonly timestamp as success.
  Generic PUT preservation: before existing role validation and CAS, replace incoming `studentLife.books` with current authoritative books for BOTH roles; books become command-owned. Load current row for teacher writes too (disable known-version shortcut when necessary); stale expected version still409. Keep all non-book collections and existing validations unchanged, no unrelated privacy refactor. Student life normalizer/merger and teacher `mergeConcurrentCurrencyUpdatesIntoSettings` preserve librarySlot. Add focused book boundary regressions plus existing mailbox/failure regression suite, no new mutation APIs for other collections.
  Task5 implements/tests these pure transforms only; activating handler protection is deferred to task6's coordinated client cutover. Current onAdd remains functional until that cutover.
  Parallelization: C; blocked by 4; server implementation follows failing tests.
  References: studentLife.ts:40-43,115-164,354-428; bookStackMission.ts:39-78; api/shared-settings.ts:139-170,267-370; tests/api/shared-settings.test.ts.
  Acceptance: invalid slot/student/book input rejects; another student's book cannot move; own legacy book placement adds no duplicate book or reward; full-room rejection preserves history; generic snapshot attempts cannot overwrite other students or placement fields. Relevant unrelated studentLife flows remain passing.
  QA: `node --import tsx --test src/lib/*Library*.test.ts tests/api/shared-settings.test.ts` with explicit synthetic stale writer and ownership attacks; signed local HTTP malformed/unauthorized requests return 400/401/403 and unchanged fake DB. Evidence task-5-*. Commit: N.
- [x] 6. Implement and prove atomic shared placement with retry-safe identity
  What to do: existing shared-settings server loads current row, validates session and placement command, computes latest book+reward state and writes with version-conditional PostgREST PATCH. Use a strictly advancing version even within one millisecond; on conflict bounded retry from fresh snapshot. Initial-row creation must be insert-only conflict/reload, not an overwriting upsert. Command request ID stable across retries and uncertain network responses. Client shared adapter reuses data modes/local fallback; no direct browser mutation bypass.
  Exact CAS: server generates `new Date(Math.max(Date.now(), Date.parse(current.updated_at)+1)).toISOString()`; validate parsed server timestamp finite. Use same monotonic rule for generic writer to avoid same-version races. At most5 attempts; retry only CAS/initial duplicate conflicts with bounded20–100ms jitter; reload and recompute each time. Initial POST uses ordinary insert without merge-duplicates;23505/409 reloads. New deterministic book ID is idempotency receipt; replay same input returns authoritative existingbook without reward recalculation. Existing-book placement never calls add/reward. General reward semantics remain existing book mission semantics. On success invalidate cachedWritableSharedSettingsRow then apply returned authoritative snapshot/version, never cache submitted stale value as full truth. Refresh reconciles remote position on conflict, carried draft retained. readonly returns explicit blocked error; mock/no-config local adapter uses same pure rules and existing local record storage, not network; configured shared failure never falls back silently. Shared page's existing timestamp/cache refs must update with returned row.
  Atomic implementation cutover: task6 includes replacing StudentLibraryPage/AuctionPage old generic book-onAdd wiring with the already visually approved Canvas UI and new placement adapter in the SAME coordinated change as generic-book protection. Do not mark task6 GREEN with old form reporting false success. Own those integration files in one worker lane. Task7 then completes full-route state/accessibility/regression verification and any UI fixes, not the initial routing switch. No deployment occurs between edits.
  Added user-requested visual subtask: replace slot-card appearance with the same-world enlarged bookcase in Game/CSS only. Prior root23-state capture is PIN/visual RED for card-grid appearance. Capture all five shelf variants, empty/mixed/full, selected/carrying/error,200%text after redesign and run two independent visual reviews before task6 completion. Serialization dependency: previous Game/CSS visual-fix owner must finish before new slot-modal owner edits those files.
  Latest user addition: remove visible directional arrow buttons while preserving keyboard movement and contextual interaction. Existing root34-state flow is keyboard PIN and visible-pad RED. Final capture must show no directional pad and retain a playable registration/placement loop.
  Discovered atomicity dependency: `api/student-economy.ts:386` also CAS-writes the whole same settings row with a potentially unchanged millisecond timestamp. Add a failing fixed-clock library/economy interleaving test, then narrowly apply strictly advancing versions to that writer as well; preserve all economy behavior. This is necessary to prevent concurrent currency/book loss, not an economy feature/refactor. Server lane owns this timestamp-only change and its regression; no SQL migration.
  Parallelization: C; blocked by 5.
  References: api/shared-settings.ts conditional PATCH; src/lib/supabaseSettings.ts:152-223; src/server/deviceSession.ts; tests/api/shared-settings.test.ts.
  Acceptance: two competing sessions same slot exactly one winner; different slots retain both records; simultaneous initial-row writes safe; timeout-after-commit retry returns same receipt/reward once; no movement request; read-only blocks writes; shared failure never silently becomes local success.
  QA: live local fake PostgREST + handler driver `curl -i` requests with redacted fake-cookie fixtures; concurrency barriers prove interleaving and state results, not just mocked call assertions. Evidence task-6-concurrency.json/log with no credentials. Commit: N.
- [x] 7. Connect the student route and verify the complete experience
  What to do: verify the full-app route already connected atomically in task6 and fix discovered refresh/legacy/failure/accessibility defects only. The initial StudentLibraryPage/AuctionPage switch belongs exclusively to task6. Verify new-book or own-unplaced-book desk choices, existing navigation/weekly mission behavior, coalesced entry/foreground refresh and shared positions. No fixture data/controls may ship on the student route.
  Parallelization: C; blocked by 6.
  References: AuctionPage.tsx:689-716,767-816,2135-2141; StudentLibraryPage.tsx; bookStackMission.ts; student feature release/hash guards.
  Acceptance: students1 and23 can enter/use; synthetic legacy records preserved; student2 sees student1 placed book after refresh; failed save retains carried draft and offers retry; winning competing book visible after conflict; no hidden movement during modal/blur; full-room registration clearly unavailable without deleting draft/history.
  QA: real full application through isolated mock and fake authenticated adapters; `page.keyboard.press`/form filling/slot selection and second context refresh; screenshots at1280×800; `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Evidence task-7-*; all owned browser/PID/port cleanup receipts. Commit: N.

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE against evidence. User already authorized execution; no redundant completion approval. Separate approval boundaries remain unchanged.
- [x] F1. Plan compliance audit
  Independent requirements/evidence matrix for every scope item and task, including no image generation, shared capacity, owner boundaries and preserved records. Reject missing or indirect evidence.
- [x] F2. Code quality review
  Independent changed-source review, typecheck/tests/build actual logs; no unsafe casts, network movement, privilege bypass, stale writers, dependency or migration drift.
- [x] F3. Real manual QA
  Root personally uses current final route at1280×800 plus two fresh independent visual reviewers; all states and failure/retry/blur verified. Evidence final screenshots/QA receipt; no completion on test-only proof.
- [x] F4. Scope fidelity
  Compare final diff with baseline dirty paths; discarded old draft deletion stays unchanged; no generated images restored, no unrelated behavior/data changed. Record outstanding approval boundaries honestly.

## Commit strategy
Direct working-tree delivery only. No commits, pushes, PR, DB changes or deployment authorized. Preserve existing dirty deletion `.omo/drafts/pixel-library-game.md`.

## Success criteria
All seven tasks and four final checks verified against fresh source. Actual playable unified scene at1280×800; 100 shared positions with atomic ownership-safe placement, old records intact, no realtime. Tests/lint/build pass, screenshots and receipts inspected, owned QA resources cleaned. Existing active goal is completed only after all evidence exists; otherwise leave it active and record the exact pending task.
