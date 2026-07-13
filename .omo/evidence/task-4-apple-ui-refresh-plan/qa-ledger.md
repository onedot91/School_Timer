# Todo 4 auction QA ledger (final current-source verification)

## Isolation

- Runtime: `127.0.0.1:4175` with `VITE_SUPABASE_URL=http://127.0.0.1:54329`.
- Data: deterministic synthetic student 1 and fake `app_settings` row only.
- Fresh full-oracle request audit: 0 live Supabase REST requests and 0 external question-service requests.
- The dedicated harness recorded only `127.0.0.1:54329` for every REST request. No production origin or real balance was opened or mutated.
- Both runs stopped their owned resources and left ports 4175 and 54329 free. The dedicated fake fixture required the harness's bounded SIGKILL fallback and was confirmed stopped; the full-oracle fixture exited normally.

## Failing-first characterization

- Baseline auction cards nested borders and shadows across room, day columns, cards, and bid panel.
- Unlocked item buttons exposed no programmatic selected state.
- Confirmation had no complete focus lifecycle; status dialog had no shared initial-focus/trap/Escape/background isolation.
- Baseline status `확인` measured 43.49–43.99 CSS px at multiple viewports.

## State and text oracle

- Shared post-change oracle: `.omo/evidence/task-3-apple-ui-refresh-plan/post-change-oracle.json`.
- Fresh run on the current source after the final modal-sequencing repair: 357/357 state×viewport records, 51 required states, success `true`, errors 0, unexpected console errors 0.
- Direct comparison persisted in `baseline-current-comparison.json`: the actual Todo 1 baseline supplies 10 auction states × 7 viewports; 70/70 snapshots are byte-equal, mismatch 0.
- Covered: loading, GET error, locked/default, selected, confirmation, delayed PATCH submitting, success, insufficient funds, forced PATCH error, and weekend empty.
- Auction horizontal overflow: 0; `targetsBelow44`: 0 across 320×568, 390×844, 768×1024, 1024×768, 1280×720, 1440×900, and 390×844 at 200% zoom.
- Independent current/baseline comparison confirms all 70 auction snapshots remain byte-equal with mismatch 0.

## Interaction and accessibility

- Selected item exposes `aria-pressed="true"`; locked items remain disabled and omit selection state.
- Bid confirmation initial focus: `다시 확인하기`; Tab: `입찰하기`; Shift+Tab wraps; Escape closes; focus returns to `입찰`.
- The final dedicated audit exited 0 with `success:true` and reached PASS for success, insufficient, and write-error initial focus (`확인`), one-control Tab/Shift+Tab containment, inert background, safe Escape, and close. Success/write-error return to the enabled `입찰` trigger; insufficient returns to the enabled amount input because its zero-balance bid button is disabled.
- Delayed PATCH proof: Escape leaves dialog count 1; backdrop click leaves dialog count 1; completion then advances to status.
- Repaired status target measures 45 CSS px high at 320, 390, 768, 1024, and 1440 widths.
- Deterministic pointer audit records pointer-down `:active`, pointer-up reversal, re-press during reversal, successful selection after re-press, and no input lockout. Reduced-motion keeps transform `none` throughout.

## Visual review

- The final dedicated run persisted 12 settled captures: loading, error, weekend empty, and confirmation at 390×844 and 1440×900, plus submitting, success, insufficient, and write-error at 390×844.
- The mobile layout keeps the current item and bid action dominant, then presents weekday inventory in one scroll direction.
- The desktop layout keeps a single window surface, removes nested card shadows, and leaves unlocked/locked inventory visually distinct.
- Confirmation is one anchored thick-material layer over one scrim; no translucent child material is stacked inside it.

## Poll and request contract

- Source remains `window.setInterval(..., 3000)`. The final dedicated harness intercepted configured delays including exactly 3000 ms.
- The harness observed 12 `GET /rest/v1/app_settings` requests, exceeding the required three, and every recorded REST method/host/path remained local to `127.0.0.1:54329`.
- Delayed success and forced error paths issue local PATCH requests only. The earlier arrival-time heuristic was invalid under dev StrictMode and was superseded by direct timer instrumentation.
- The corrected poll instrumentation reran on the current source and passed with `success:true`.

## Static verification

- `npm run lint`: pass.
- `npm run build`: pass; only the pre-existing Vite chunk-size warning remains.
- `git diff --check`: pass.
