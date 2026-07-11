# Cleanup receipt: canonical bounded run

The canonical run owned and stopped:

- PID 38190: fake Supabase on `127.0.0.1:54329`
- PID 38205: Supabase-enabled Vite on `127.0.0.1:4175`
- PID 39235: Supabase-disabled Vite on `127.0.0.1:4175`

Cleanup began `2026-07-11T13:34:07.107Z` and completed `2026-07-11T13:34:07.190Z`. The runner also closes Chromium. Cleanup is reserved inside the 110,000 ms whole-run deadline and every cleanup wait uses the remaining deadline budget.

The separate 6,000 ms deadline-path run also stopped its owned fake Supabase PID 37411 and Vite PID 37426 before recording free ports. See `deadline-path-results.json`.

Final port commands, run after each path:

```sh
lsof -nP -iTCP:4175 -sTCP:LISTEN
lsof -nP -iTCP:54329 -sTCP:LISTEN
```

Both commands returned no listener output. No service on `localhost:3000` was started or stopped.
