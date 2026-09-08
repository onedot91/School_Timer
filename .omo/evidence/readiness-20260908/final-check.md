# Final readiness evidence check

- Exact SHA: `98c14b58f53dc98dfe63089b2095fe25342c879d`
- Result: **PARTIAL**
- Gate recommendation: **APPROVE WITH EVIDENCE NOTES**
- Source changes: none

## Original intent

Assess whether the reviewed release is fit for tomorrow's classroom use, especially concurrent sharing and saves, without claiming that every bug is absent, mutating production student data, or treating old alerts as recovered records.

## Desired outcome

The final report should accurately distinguish source/test evidence, isolated synthetic transactions, browser observations, and read-only production checks. It should preserve the uncertainty around the six predeployment `SHARED_SETTINGS_CONFLICT` alerts.

## User outcome review

The main readiness conclusion is proportionate: `REPORT.md` says no blocking defect was found **in the reviewed paths** and immediately says this does not guarantee the absence of all errors. The report also clearly says production checks were read-only and that transactions were exercised only in an isolated class/database. It does not claim the six old alerts were recovered; it says their individual saves cannot be assumed recovered and that the alerts and student records were left untouched.

The release evidence is internally consistent. `98c14b58-release/manifest.json` records all ten gates passing with `unchanged:true`; `unit-api.log` records 1,047 pass, 0 fail, 0 skip; the PostgreSQL, HTTP, reward, Classword, emitted-runtime, restore, typecheck, and build logs support the summarized synthetic concurrency, idempotency, isolation, reconciliation, restore, and build claims. The five lane reports in `ledger.jsonl` exist at the named paths and all identify the exact SHA.

The browser evidence supports the synthetic nature of the exercise and the database end states: `browser-maintenance.json` records zero blocked letters, balance 105, and reconciliation `[]`; `browser-after-retry.json` records one retry letter, balance 105, one new ledger row, and reconciliation `[]`. `browser.md` records the parent reviewer's direct observations of cross-session mail/reply, +5 reward persistence, draft persistence, and one manual retry. Those UI observations are attestations rather than independently reproducible raw artifacts.

## Unsupported or only partially supported claims

1. **Operational counts/control state in `REPORT.md:13` are not present in the supplied production JSON artifacts.** The claim `active=true maintenance=false, 23 wallets, 2761 ledger rows, reconciliation 0` appears in the prose reports/debug journal, but `production.json` contains deployment/HTTP metadata only; `production-functions.json` contains function fingerprints/privileges; `function-comparison.json` contains only the 18-function match result. No supplied raw JSON records those four operational values. This is an evidence gap, not evidence that the values are false.

2. **The browser's exact cross-session UI observations are supported only by reviewer prose.** The two browser JSON files prove post-action database aggregates, but do not contain screenshots, DOM captures, request traces, or message bodies proving automatic teacher/student receipt, exact rendered reply content, preserved draft text after reload, or the absence of a success state during maintenance. The task context states the parent personally drove these scenarios, so the claims may remain as explicitly observed manual QA, but they are not independently reproducible from the retained artifacts.

3. **The production alert timing claim is adequately bounded but deployment time is indirect.** `production-alerts.json` proves six unacknowledged alerts and `since_deployment: 0`; `production-old-alert-summary.json` proves all six are `SHARED_SETTINGS_CONFLICT` between 07:14 and 07:17 UTC. These artifacts support “no new report since deployment” and do not support recovery of any affected save. The exact deployment timestamp itself is not included in `production.json`, so the predeployment label relies on the query-derived `since_deployment` field.

## Direct remove-ai-slops / programming pass

The reviewed reports explicitly include both skill perspectives. The test/log inventory covers observable concurrency, privacy, receipt replay, failure, maintenance, tamper, and restoration outcomes. I found no deletion-only test, test that merely verifies a requested removal, prose/prompt pin, tautological expected value, or production normalization/extraction added solely to satisfy the review. The noted 285-pure-LOC repository module and unused import are maintenance notes and do not violate the stated classroom-readiness criteria.

## Blockers

None against the stated readiness criteria. The result is `PARTIAL` because two prominent aggregate claims lack raw retained evidence, not because a tested sharing/save behavior failed.

## Checked artifacts

- `/tmp/school-storage-review-evidence/REPORT.md`
- `/tmp/school-storage-review-evidence/ledger.jsonl`
- `/tmp/school-storage-review-evidence/{goal,context,code,security,qa}.md`
- `/tmp/school-storage-review-evidence/98c14b58-release/manifest.json`
- `/tmp/school-storage-review-evidence/98c14b58-release/*.log`
- `/tmp/school-storage-review-evidence/production.json`
- `/tmp/school-storage-review-evidence/env-metadata.json`
- `/tmp/school-storage-review-evidence/function-comparison.json`
- `/tmp/school-storage-review-evidence/production-functions.json`
- `/tmp/school-storage-review-evidence/production-alerts.json`
- `/tmp/school-storage-review-evidence/production-old-alert-summary.json`
- `/tmp/school-storage-review-evidence/browser.md`
- `/tmp/school-storage-review-evidence/browser-maintenance.json`
- `/tmp/school-storage-review-evidence/browser-after-retry.json`
- source checkout `/tmp/school-storage-review-20260908` (`git rev-parse HEAD` reproduced the exact SHA)

## Exact evidence gaps

- Raw production query output for storage control state, wallet count, ledger count, and wallet reconciliation.
- Retained browser screenshot/DOM/network evidence for the exact mail/reply text, automatic cross-session refresh, maintenance error state, and reload-preserved draft text.
