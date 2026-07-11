# Todo 1 baseline notepad

- 2026-07-11: final review found that the claimed whole-run deadline was not wired and Alt+Meta+Enter was absent from the current canonical matrix.
- Current canonical baseline owns fake Supabase/Vite lifecycle, reserves cleanup within its 110-second total deadline, runs 11 isolated browser scenarios at two viewports, and emits 22 required PNG records.
- A separate 6-second deadline run exited nonzero, cleaned its owned local processes, and did not overwrite canonical success.
- Production source intentionally untouched. `git diff -- src` and `git diff --cached -- src` are empty.
