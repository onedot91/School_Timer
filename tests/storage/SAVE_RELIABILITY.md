# Save reliability verification

## Browser release gate

`npm run verify:release` includes `save-browser` after the production build. It fails when the browser prerequisites are missing, a scenario fails, a request escapes the localhost fixture, or an uncaught browser error occurs. No browser package is downloaded and no live student account or backend is used.

Required environment variables, in addition to the existing isolated PostgreSQL prerequisites:

```sh
export STORAGE_TEST_BROWSER_MODULE=/absolute/path/to/installed/playwright
export STORAGE_TEST_CHROMIUM_EXECUTABLE=/absolute/path/to/chromium
node tests/storage/saveReliabilityBrowser.mjs
```

The runner builds `saveReliabilityBrowser.html` with Vite production settings, without loading the project's environment files. The actual draft database/store, storage client, game hooks, and student form components are imported from `src`. Layout scenarios import the actual stylesheet with the project's Tailwind scan root. Chromium uses its native IndexedDB and isolated browser contexts. The HTTP fixture binds only to loopback, uses synthetic requests and receipts, and blocks every nonlocal browser request. Build files, screenshots, and `manifest.json` are written to a fresh operating-system temporary directory.

### Browser scenarios

| Scenario | Required observation |
|---|---|
| Legacy localStorage migration | Original request ID and payload are durably present in native IndexedDB before the legacy copy is removed. |
| A confirmation after B edit | A cannot remove B; B's request ID and content survive reload. |
| Two tabs | Concurrent native IndexedDB compare-and-set has exactly one winner; an old conditional delete cannot remove it. |
| Native IndexedDB quota failure | Latest B remains in memory, is marked nondurable, blocks unsafe reload, and is available as recovery text; after storage recovers, B survives reload. |
| Committed write with truncated response and unavailable projection | Receipt-only confirmation succeeds, reports `refreshPending`, and never resubmits the write. |
| Unconfirmed request across reload | Automatic recovery reuses the original request ID and payload while keeping newer form B. |
| Actual Sudoku hook, delayed A response | B remains visible while A is pending; B saves after A's exact projection/revision is confirmed. |
| Actual Sudoku hook, failed save and reload | The most recent unsaved cell is restored. |
| Actual number baseball page | Unsubmitted digits survive reload; after a committed attempt's response is lost, the retry confirms that attempt without adding a second POST or guess. |
| Actual mailbox | Late draft hydration restores A; local C survives stale B props and the delayed success of A, with compose still open. |
| Actual emotion page | Late draft hydration restores A; local C remains editable after stale B props and A success. |
| Actual failure composer | Late draft hydration restores A; C and a subsequently reopened dialog D survive earlier success callbacks. |
| Actual word quiz | Inputs stay disabled while native IndexedDB open is delayed; a saved answer is restored before editing resumes. A later quota error keeps the new answer editable and shows the local-storage warning. |
| Actual Today Friend form | The pending payload is displayed while hydration is delayed; once hydration finishes, confirmation is enabled and submits the original payload. |
| Actual emotion conflict | Explicit retry receives exactly the reviewed revision. A second conflict exposes its new revision while keeping C; D typed during retry survives the earlier success. Unavailable, checking, and expired states cannot silently submit. At 1280×650, 1280×600, and 1280×800 the main action remains reachable, at least 44px high, and unobscured without moving the document. |
| Actual Sudoku conflict | A 409 keeps local B alongside remote A. Explicit adoption adds no POST, new C uses the reviewed revision, and archived B survives reload. The action remains reachable at 1280×650 and 1280×600. |
| Actual number baseball conflict | The server's 400 `GAME_PROGRESS_CONFLICT` exposes local and remote attempts. Explicit adoption adds no POST; the next guess extends the remote prefix, and the archived local guess survives reload. The action remains reachable at 1280×650, 1280×600, and 1280×800. |

### Observed result, 2026-09-09

- Chromium production fixture: **17 / 17 passed**, uncaught page errors **0**.
- Browser evidence: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/school-save-browser-EdgKcU/manifest.json` and its Sudoku/baseball/emotion screenshots.
- The actual emotion, Sudoku, and number baseball conflict screenshots were inspected at 1280×600. Local/server inputs and the explicit recovery action were visible and reachable. The automated layout checks additionally cover the viewport sizes listed above.
- Release prerequisite tests: **4 / 4 passed**.
- The quota scenario initially exposed a real uncaught `IDBObjectStore.put` callback exception. After the database transaction guard was corrected, the same scenario passed without a page error.
- Injected 400/409/503 responses and handled storage-confirmation errors are recorded in the browser console evidence; these are deliberate fault scenarios. This component/hook fixture uses a synthetic HTTP backend. It does not replace complete RootApp/student/teacher page checks, actual cookie-authenticated API/PostgreSQL integration checks, or verification of a deployed production site.

## Runtime protection coverage

| Path | Draft and request identity | Confirmation and replay policy | Conflict or context boundary |
|---|---|---|---|
| Student mail, writing/failure records | Native IndexedDB editable form and immutable submitted request; conditional version cleanup | Receipt first; submitted ordinary records retry with the same ID | Student/session and original submission day |
| Emotion | Separate date-scoped form and submitted request | Receipt first; ordinary-record recovery | Exact edit revision; latest/mine comparison and explicit reapply; date transition preserves old draft |
| Classword entry and word quiz | Dedicated stores use the common durable database; original legacy request IDs retained | SHA-256 receipt binding; only identified current-context submissions retry | Signed cookie versus requested student, original topic/question/date |
| Today Friend | Immutable submitted answer separated from editable content | Bound receipt first, same request on allowed ordinary-record recovery | Student, plan/question and original date |
| Library record | Book draft and submitted slot retained together | Receipt result can confirm the placed book even when projection fails | Original student, season and slot; older requests without placement identity are confirmation-only |
| Sudoku / number baseball | Latest queued edit saved before transmission; old ACK cannot clear newer edits | Persisted request confirmation before new progress; archive accessible after reload | Exact Sudoku revision / baseball prefix; explicit latest adoption never sends a write |
| Profile and pet state | Common durable submitted request | Receipt first; economic actions stay confirmation-only | Own student revision where state is replaced; server-side wallet transaction unchanged |
| Purchases, bids, bank, donations, deductions and teacher commands | Original immutable command retained | Automatic result lookup only; user action required to repeat a mutation | Existing authenticated authorization, atomic RPC and deduplication |
| Teacher settings | Durable editor separated from pending patch | Confirmation-only recovery; edits after a submission survive its ACK | Existing field-level before/after conflict check; null projection never resets displayed state |

All automatic recovery respects the authenticated actor and original context, serializes an actor's sends, honors the first server `Retry-After`, and pauses after five failed sends. Merely editing a form does not submit it. Device persistence failure leaves the newest text in memory, warns the user, protects navigation/reload and exposes a copy/selectable-text fallback. Diagnostics retain permitted identifiers, build version, stage and retry count, never student-written payloads.

A receipt's commit timestamp is not a snapshot watermark. The database can timestamp a resource before it creates the receipt. A display refresh therefore uses a per-actor confirmation generation: a GET started before a newer confirmation is ignored, while a GET started after confirmation may apply the valid earlier resource timestamp.

## Production investigation and rollout boundary

Read-only inspection on 2026-09-09 verified the Seoul production database's active storage-v2 mode, immutable wallet-ledger guard, receipt uniqueness and service-only RPC permissions. The new Classword transport-hash and question/topic-context checks were **not yet applied at inspection time**. This document does not itself certify deployment.

Production alert counts showed a concentration of weekly-mission failures around 09:00 KST. Inspection also reproduced two amplification defects: focus/visibility could issue duplicate requests, and one student's request could settle every student's historical Classword entries. The correction coalesces duplicate checks, honors cooldown/Retry-After, and limits historical recovery to the requesting student. The 23-session synthetic reproduction reduced reward RPC calls from 552 to 46; those numbers are fixture measurements, not observed production traffic. Alert acknowledgement is not proof of record recovery, and alert codes alone do not identify the original upstream failure.

Deployment order is additive SQL, compatible server contracts, client protection, then legacy unsafe-write rejection. The authenticated metadata opt-in `?metadata=1&capabilities=1` and `X-Storage-Edit-Revisions` response header expose the running guard state. Production checks must identify the served deployment and verify this state, rather than relying on local build success or saved SQL-editor snippets. No real student record, balance or history is modified for QA.

## Full application, authenticated HTTP and PostgreSQL gate

`save-full-stack` in `verify:release` runs `node --import tsx tests/storage/saveReliabilityFullStack.ts`. It builds the actual `index.html` and RootApp in production mode with dummy loopback backend configuration, so student/teacher saves use server APIs rather than the local fallback. The existing HTTP harness invokes the real device-session authentication, shared-settings handlers, storage repositories and SQL functions against an isolated PostgreSQL database. Both browser and server external requests are blocked.

The scenarios preserve an actual Chromium profile across restarts, restore an unsent mailbox draft, lose the browser response after the API has committed, recover with the original receipt ID after restart, read the same letter in the teacher screen and verify exactly one database letter/receipt with all 23 wallet balances and another student's record unchanged. The legacy-write guard is enabled. A focus/visibility/online burst also checks that the weekly-mission single-flight and failed-request cooldown prevent duplicate requests.

This joins the browser, authentication and database paths in one test. It still does not simulate Vercel's infrastructure, a school's Wi-Fi or the live Supabase network. Those deployment boundaries require separate production checks; unrelated feature APIs return an explicitly recorded fixture 503 instead of contacting live services.
