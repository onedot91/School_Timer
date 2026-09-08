# Student command and draft QA

Date: 2026-09-08. All mutations used isolated fake or mock state. No live student data was changed.

## Implemented boundaries

- Student mail, failures, pets, emotions, auction bids, Sudoku and number baseball use semantic server commands. Payloads contain intentions, not wallet/history snapshots.
- Server validates actor, eligibility, reservations, puzzle solutions and rewards. Other students and legacy raw records are preserved.
- Immutable command IDs survive uncertain writes and reload. Explicit retry confirms a receipt or retries the same ID. A changed intent cannot replace an unconfirmed command.
- Definite business rejection preserves editable input; subsequent explicit edited submission uses a new ID. Reload prefers the latest editable form after definite rejection.
- Economy actions share one per-student pending command, with explicit receipt recovery and no duplicate charge from changed input.
- Remote reward projections use timestamp-gated shared state; Classword and weekly mission receipts trigger authoritative refresh.

## Automated validation

- Dispatcher + command/draft wrapper + auction-refresh tests: 20/20 passed.
- Final wrapper assertions (including edit after definitive rejection restoration): 3/3 passed.
- Final `npm run lint`: passed.
- Earlier related Sudoku/baseball/draft tests: 43/43 passed.
- Direct fake dispatcher driver: letter send/read and pet feed produced `letterRead:true`, actor wallet95, unrelated wallet333.

## Browser observations

Used isolated Vite at 127.0.0.1:3117 with React and Tailwind plugins, no API proxies. The harness intercepts every /api/ request. Actual components and real draft wrapper were exercised.

- Mailbox: fake502 preserved title/content and same pending request across reload. Explicit allow-success then retry completed and cleared draft.
- Emotion: chosen emotion and both text fields survived fake502/reload. Explicit retry confirmed and showed the saved entry.
- Failure story: both fields survived fake502/reload; explicit same-request retry completed and closed the dialog.
- Mailbox definitive400: fields remained editable; edited text survived close/reopen, and next manual send completed.
- Actual mock AuctionPage student23 booted with mock100 balance. Mail draft survived leaving for overview and returning. Successful local send followed by reload showed an empty compose form.
- Actual mock page console error list was empty.

Viewport checks before final CSS: failure at1280x600 had dialog30..570 and action484.77..544.77 (height60); at1280x800 action582.88..642.88. Emotion at1280x650 showed the complete modal/action. Mailbox at1280x600 stayed within document1280x600 and had bounded form scrolling. Final two scoped CSS rules fix compose-body/textarea overlap; root owns final viewport regression after this CSS.

## Handoff limits

- Fake browser QA establishes input/retry behavior, not database transaction correctness. Root and economy agents own real HTTP/Postgres tests and deployment.
- Root owns final1280x650/600/800 QA and deployed-region verification.
- Root notified that studentSettingsSync timestamp acceptance must preserve PostgreSQL microsecond order rather than Date.parse milliseconds.
- Only these new CSS rules belong to this subtask; other index.css diffs are unrelated:

```css
.student-mailbox-view .student-compose-body-field { grid-template-rows: auto minmax(6rem, 1fr); }
.student-mailbox-view .student-compose-card textarea { min-height: 6rem; }
```
