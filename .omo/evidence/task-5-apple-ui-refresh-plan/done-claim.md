# Todo 5 DoneClaim (superseding)

## Scope and result

- Changed only `src/index.css` in the `TIMER_HOME` subsection for this todo.
- Added no visible copy and changed no timer, schedule, audio, persistence, Supabase, balance, or classroom-data logic.
- The top announcement editor alone has no normal-mode focus outline, border, or shadow. Currency and other text fields retain green accessible focus. Forced colors retain the operating-system focus indicator.

## Verifier fixes

1. Top announcement focus:
   - normal computed outline width `0px`, transparent border, `box-shadow: none`;
   - announcement notebook textarea remains `rgb(0, 122, 87)`;
   - currency input remains `rgb(0, 98, 65)`.
2. Embedded reset capture:
   - the reset action is independently retriggered before every viewport snapshot;
   - all seven `timer/embedded-draw-reset` records now include `섞는 중` and match baseline.
3. 200% schedule:
   - capture explicitly sets `.schedule-scroll.scrollTop = 0`;
   - screenshot shows `아침활동`, `1교시`, `쉬는 시간`, and `2교시` without clipping or overlap.
4. Shell overflow:
   - walking characters use viewport-fixed positioning because their path is expressed in `vw`/`vh`;
   - shell `scrollWidth === clientWidth` at all seven records: 294, 364, 768, 1024, 1280, 1440, and 169 CSS px at 200%.
5. Audio unavailable:
   - isolated `HTMLMediaElement.play()` rejects with local `NotSupportedError`;
   - keyboard activation changes label/title to `배경 음악 다시 시도` without external audio or product writes.

## Verification

- Timer targeted QA: pass.
  - 7/7 timer-default exact visible-text records.
  - 0 targets below 44px.
  - 0 page or shell horizontal-overflow records.
  - manual timer, empty schedule, keyboard order, 200% scroll-top, and audio-failure behavior pass.
- Focus QA: pass in normal, forced-colors, increased-contrast, and reduced-transparency modes.
  - product mutation attempts were blocked before network delivery;
  - fixture received zero product mutations.
- Complete current oracle runner: exits 0 with 357/357 records, no escaped live Supabase request, no escaped external question-service request, and no unexpected console error.
- Baseline text comparison: 357/357 exact.
  - Timer, entry, root, and auction records, including reset, remain 329/329 exact from the isolated complete oracle.
  - The former Todo 1 standalone oracle is invalid and superseded only for `default`, `settings`, `after-settings`, and `winner` at the seven required viewport records because it inherited TimerPage-owned draw storage.
  - Those 28 records were rebuilt from a detached pristine `f5a90d8` clone and the current source using the same standalone-only entry, empty localStorage, fixed clock, deterministic random sequence, and blocked external requests. Exact UTF-8 visible-text arrays match 28/28 with zero mismatches.
  - Neither run loaded TimerPage or live classroom storage. Both local Vite processes stopped and ports 4176/4177 are free.
- `npm run lint`: pass.
- `npm run build`: pass with the existing Vite large-chunk warning.
- `git diff --check`: pass.

## Data safety

- No live classroom origin was opened.
- All external requests were blocked.
- Browser POST/PATCH attempts were aborted before fixture delivery.
- Fixture product mutations: zero.

## Evidence

- `timer-home/results.json`
- `timer-home/default-*.png`
- `timer-home/empty-schedule-390x844.png`
- `focus-ring/results.json`
- `focus-ring/*-top-announcement.png`
- `focus-ring/*-currency.png`
- `complete-current-oracle.json`
- `random-draw-pristine-comparison.json`
- `random-draw-pristine-repair.md`
