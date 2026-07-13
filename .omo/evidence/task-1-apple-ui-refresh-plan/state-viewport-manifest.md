# Todo 1 corrected state×viewport manifest

## Hard gate

- Current HEAD: `f5a90d8d0e94bc43c3338a47aea5bb14cb0e19d9`.
- Runner SHA-256: `8ca57d302a85a4e065a505ea6fdff4f6737aac5b7ed29636d4cc6dc1c35cf270`.
- Required direct states: 51.
- Required variants per state: 320x568, 390x844, 768x1024, 1024x768, 1280x720, 1440x900, and 390x844 at 200% zoom.
- Expected and actual records: 357.
- The runner fails on any missing, duplicate, unexpected, conditionally skipped, empty-text, wrong-viewport-count, or horizontally overflowing record.
- Two current-runner executions produced identical ordered visible text, focus order, overflow, and focus-lifecycle JSON.

## Directly captured state IDs

```text
entry/default
root/runtime-fallback
root/invalid-storage
root/shortcut-alt-meta-enter
root/shortcut-alt-ctrl-enter
timer/default
timer/empty-schedule
timer/manual-timer
timer/memo
timer/currency-personal
timer/currency-invalid-number
timer/currency-all
timer/question-submitted
timer/question-loading
timer/question-error
timer/question-empty
timer/youtube-playlist
timer/youtube-search
timer/library
timer/announcement-default
timer/announcement-history
timer/settings-shell
timer/settings-과목
timer/settings-경매
timer/settings-시간표
timer/copy-confirmation
timer/settings-추첨
timer/auction-award-confirmation
timer/auction-award-presentation
timer/auction-reset-confirmation
timer/embedded-draw-rolling
timer/embedded-draw-winner
timer/embedded-draw-repeat
timer/embedded-draw-reset
auction/loading
auction/error
auction/locked-or-default
auction/selected
auction/confirmation
auction/submitting
auction/success
auction/insufficient
auction/write-error
auction/weekend-empty
random-draw/default
random-draw/settings
random-draw/after-settings
random-draw/winner
random-draw/reset
random-draw/exhausted
random-draw/invalid-range
```

The async auction cases use only the in-memory fake row: delayed GET for loading, forced GET failure for read error, delayed PATCH for submitting, successful local PATCH for success, a confirmation opened before the local balance is changed to zero for insufficient funds, and a forced local PATCH failure for write error. No production balance, bid, award, or history was touched.

## Focus lifecycle baseline

The runner physically presses Tab, Shift+Tab, and Escape and records activeElement, whether focus remains in the active surface, surface count after Escape, and inert/aria-hidden/pointer-events state for body children. It then reopens a surface only when Escape actually closed it.

The current pre-change baseline exposes defects that implementation must repair rather than hiding them:

- Timer memo: initial focus is absent; forward Tab escapes the overlay; Escape closes it.
- Timer settings and standalone draw settings: no dialog semantics/background isolation; Tab escapes; Escape does not close.
- Auction confirmation: Tab escapes; Escape does not close; background is not inert.
- Timer award/reset child confirmations: Tab remains within the broad settings subtree but parent settings is not inert/aria-hidden; Escape does not close the child.
- Across all records, 2,424 focusable target measurements are below 44 CSS px. This is the exact remediation baseline.

## Truly unreachable state

Only `timer/embedded-draw-empty` is deferred. In current HEAD, `startStudentDraw` builds `rollingPool` from every integer in the normalized inclusive min/max range. Both bounds are clamped to 1..999, so `rollingPool.length === 0` cannot be produced by any persisted payload or UI action.

Exact replay proof:

- Fake `app_settings.value.randomDraw` payload:
  `{"activeCaseId":"case-a","repeatPickEnabled":false,"cases":[{"id":"case-a","label":"빈 상태 검증","rangeStart":null,"rangeEnd":null,"historyEntries":[]}]}`
- Page: Timer home with all overlays/panes/settings closed and focus outside editable controls.
- Action: `page.keyboard.press('ArrowRight')`.
- Fixed observations: 0ms, 80ms, 1300ms, 2240ms.
- Current result: payload normalizes to a nonempty range and enters rolling/winner flow; the empty overlay branch is unreachable.

This state is represented in each canonical JSON file under `unreachable`; it is not counted among the 51 passing states.

## Isolation and cleanup

- Vite `127.0.0.1:4175`; fake Supabase `127.0.0.1:54329`.
- Empty contexts, fixed ko-KR/Asia-Seoul weekday and weekend clocks, deterministic Math.random.
- Question loading/error/empty/submitted responses are local route fulfillments.
- External `*.supabase.co` fetches are replaced before network dispatch.
- Both runs: live Supabase REST 0, external question requests 0, unexpected console/page errors 0.
- Both runs closed contexts/Chromium, stopped both owned servers, and left 4175/54329 free.
- `git diff -- src`, `git diff --cached -- src`, and `git status --short -- src` are empty.
