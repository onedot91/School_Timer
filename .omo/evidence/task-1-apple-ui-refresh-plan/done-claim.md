# DoneClaim: Todo 1 evidence-harness blockers resolved

The canonical evidence harness is corrected without product edits.

- Canonical: `baseline-results.json` reports `success: true` for 11 Playwright scenarios, 22 PNG audits, both reset shortcuts, local-only Supabase REST, zero unexpected console/page errors, and free ports.
- Deadline adversarial: `deadline-path-results.json` is a separate 6,000 ms run that exited 1, recorded the whole-run timeout, stopped its owned fake Supabase/Vite processes, and left 4175/54329 free.
- Scope: `git diff -- src`, `git diff --cached -- src`, and `git status --short -- src` were empty. No production or live classroom data changed.

Exact commands and cleanup evidence are in `run-log.md` and `cleanup-receipt.md`.
