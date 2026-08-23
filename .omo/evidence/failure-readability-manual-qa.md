# Failure exhibition readability manual QA

**Date:** 2026-08-23 (Asia/Seoul)  
**Verdict:** PASS

## Isolation and data safety

- The app was served at `http://127.0.0.1:3006` with `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` explicitly empty.
- The browser used disposable `localStorage` fixture data containing three synthetic failure stories.
- Network auditing recorded zero requests to `/rest/v1/` or `supabase.co`.
- The run clicked only the cheer-stamp menu trigger and the failure-composer trigger. It did not click a stamp option, submit, edit, delete, donation, currency, bid, or other mutation control.

## Observed matrix

| Surface | Result |
| --- | --- |
| 1024×800 | PASS: three rows visible; 20px primary and 17.6px secondary type; no horizontal overflow |
| 1280×800 at 100% | PASS: three rows visible; `다음에는` absent; writing prompts absent from published rows |
| 1366×800 | PASS: three rows visible; no clipping or horizontal overflow |
| 1280×800 at 200% text | PASS: gallery scrolls internally; no horizontal overflow; FAB overlaps no interactive target |
| 1280×800 compose modal | PASS: 32px heading, 21.6px questions, 19.2px inputs, 20px action; dialog remains inside viewport |
| Cheer-stamp menu | PASS: three options; menu does not overlap the next row |

## Copy observed

- Published rows show the failure and the student's next-attempt text with an arrow only.
- The compose modal shows `어떤 실패를 했나요?` and `다시 해 본다면 무엇을 바꾸고 싶나요?`.
- `다음에는` and `익명` were not present in the rendered failure-exhibition surface.

## Artifacts

- `tmp/failure-feed-1024x800.png`
- `tmp/failure-feed-1280x800.png`
- `tmp/failure-feed-1366x800.png`
- `tmp/failure-feed-1280x800-text-200.png`
- `tmp/failure-feed-stamps-final.jpg`
- `tmp/failure-modal-readable-1280x800.png`
