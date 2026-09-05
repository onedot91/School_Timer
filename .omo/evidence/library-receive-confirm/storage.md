# One-line reflection persistence

Completed 2026-09-05. Storage/client/domain responsibility only; no live database writes, dependencies, commits, migrations, or servers.

## Changes

- `src/lib/studentLife.ts`: optional readonly reflection, shared `normalizeBookReflection` and `MAX_BOOK_REFLECTION_LENGTH=100`; preserves trimmed 1–100-character single-line reflections and accepts unknown page count `0` only with a valid reflection. Existing positive-page books without reflection keep their original shape.
- `src/lib/canvasLibraryWorld.ts`: draft metadata and canvas placement preserve validated reflection.
- `src/lib/canvasLibraryPlacement.ts`: strict command parsing, mission input, and idempotent replay equality carry reflection.
- `src/lib/bookStackMission.ts`: input passes reflection through the existing book/reward transition.
- `src/lib/canvasLibraryClient.ts`: request identity, outgoing command, receipt/authoritative equality checks, and placed-book conversion preserve reflection. Invalid leading/trailing CR/LF is not silently trimmed away.
- `src/lib/bookReflection.test.ts`: 18 focused boundary and round-trip tests.

## Verification

1. Legacy baseline: `node --import tsx --test src/lib/canvasLibraryWorld.test.ts src/lib/canvasLibraryPlacement.test.ts src/lib/canvasLibraryClient.test.ts src/lib/studentLife.test.ts src/lib/bookStackMission.test.ts` — 79/79 passed before implementation.
2. RED: `node --import tsx --test src/lib/bookReflection.test.ts` — original 17/17 tests failed on missing reflection behavior. Added a separate leading-newline client regression, observed it fail because client trimming wrongly accepted the newline, then fixed it.
3. GREEN: `node --import tsx --test src/lib/bookReflection.test.ts src/lib/canvasLibraryWorld.test.ts src/lib/canvasLibraryPlacement.test.ts src/lib/canvasLibraryClient.test.ts src/lib/studentLife.test.ts src/lib/bookStackMission.test.ts` — 97/97 passed.
4. `npm run lint` — passed after fixing the new test's discriminant narrowing. Focused reflection suite then reran: 18/18 passed.
5. `git diff --check` — passed.

API inspection: `api/shared-settings.ts` `handleLibraryPlacement` calls `applyLibraryPlacementCommand`, then passes `placement.value` to the existing atomic `commitCompetition` or `saveValue` path, returning `placement.book`. No separate reflection field whitelist/schema or migration is needed. Existing page-height and reward formulas are unchanged.

## Manual library surface QA

Ran the actual client with fake isolated storage, then JSON serialization/restoration and a mismatched replay through the real domain. Exact invocation from repository root:

```sh
node --import tsx --input-type=module <<'NODE'
import { createCanvasLibraryClient } from './src/lib/canvasLibraryClient.ts';
import { applyLibraryPlacementCommand } from './src/lib/canvasLibraryPlacement.ts';
import { normalizeStudentLifeState, getBookStackHeightCm } from './src/lib/studentLife.ts';
const now = '2026-09-05T03:00:00.000Z';
const oldBook = { id: 'isolated-legacy', studentNumber: 1, title: '기존 책', author: '작가', pageCount: 120, createdAt: now, colorIndex: 0 };
let snapshot = { studentLife: { books: [oldBook] } };
let writes = 0;
const client = createCanvasLibraryClient({ dataMode: 'mock', isSharedConfigured: false,
  createRequestId: () => '123e4567-e89b-42d3-a456-426614174000', now: () => now, requestTimeoutMs: 100,
  fetcher: async () => { throw new TypeError('No network allowed in manual QA'); },
  loadLocalSnapshot: () => snapshot,
  storeLocalSnapshot: value => { snapshot = JSON.parse(JSON.stringify(value)); writes++; return true; },
  invalidateSharedCache: () => undefined, withLocalLock: async action => action(),
});
const draft = { studentNumber: 1, title: '한 줄 감상 책', author: '고마', pageCount: 0, reflection: '  친구의 마음이 궁금해졌어요.  ' };
const placed = await client.placeBook(draft, 2);
const invalid = await client.placeBook({ ...draft, reflection: '\n줄바꿈 감상' }, 3);
const restored = normalizeStudentLifeState(snapshot.studentLife);
const replay = applyLibraryPlacementCommand(snapshot, 1, { action: 'placeLibraryBook', requestId: '123e4567-e89b-42d3-a456-426614174000', slotId: 2, book: { kind: 'new', title: draft.title, author: draft.author, pageCount: 0, reflection: '다른 감상' } }, now);
console.log(JSON.stringify({ surface: 'actual client with isolated JSON snapshot', placed: placed.ok ? placed.placedBook : placed, restored: restored.books, totalHeightCm: getBookStackHeightCm(restored.books), writes, invalid, replay }, null, 2));
NODE
```

Observed: successful placed-book response had `pageCount:0`, trimmed reflection `친구의 마음이 궁금해졌어요.`, slot 2. Restored snapshot contained both the unchanged 120-page legacy book and new reflection book. Total height remained `0.6` cm. Exactly one write occurred. Newline input returned `INVALID_LIBRARY_COMMAND` without a write; changed-reflection replay returned HTTP-domain status 400 / `INVALID_LIBRARY_COMMAND`.

## Scope / review

New helper owns reflection parsing and is reused across storage, command, canvas, and client boundaries. No new unchecked casts, assertion suppression, logger, or dependency. Existing code styles and entry points retained. Pure LOC: studentLife 427, bookStackMission 74, canvasLibraryWorld 346, canvasLibraryPlacement 233, canvasLibraryClient 257, bookReflection tests 121. Existing oversized modules were kept intact under the explicit narrow-scope/no-refactor task constraint; structural refactoring was not introduced. UI/browser QA and full build belong to the parent task. No storage blockers remain.
