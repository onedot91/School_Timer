# Task 2 independent verification

Verdict: confirmed for the isolated small playable room only. This does not approve the full100-slot game, shared storage, route cutover, or task3 whole-scene gate.

Root independently exercised current product imports through `.omo/evidence/canvas-library/play.html` using a real1280×800 Chrome viewport. Latest receipt: `root-play-qa.json`, generated2026-09-05T06:10:46.832Z, passed=true. All source hashes stayed unchanged across that run, including the shared modal helper and scoped CSS.

## Observed behavior

- Actual held-key travel to desk, invalid page0 rejection, book draft carried without immediate placement, travel to shelf, keyboard slot selection and cancellation/reopen, placement visible in room before details.
- Actual approach to placed book and inspection of exact title/author/pages/student. Second registration via pointer desk action, second book placed beside occupied slot, escaped HTML-like author rendered literally with no image element.
- Roving slot1→7, eight forward Tabs contained, Escape returns to Canvas. Independently reran `focus-trap-qa.mjs`: backward Tab goes7→close→7 and Escape returns to Canvas, exact helper hash stable.
- Real held-key tab blur clears movement and refocus does not resume it. Reduced-motion setting still permits movement.
- Fifteen PNG captures cover empty, walking/settled, registration, invalid input, carry, slots, placement start/mid/settled, details, long title,200% text top/actions and reduced motion. The capture script validates PNG signatures and1280×800 dimensions. Root personally inspected the images;200% dialog uses bounded internal scroll, and both return and close controls remain reachable without document overflow.
- The original flat room, window-plane inconsistency, duplicated carry badge, Tab escape and orphan title line were explicitly rejected and corrected before this capture. The following task still requires independent whole-scene reviewers, not merely this behavior pass.

## Automated checks

- World tests14/14 and real pure-world driver exit0: collision, normalized diagonals, bad times/inputs, all18 current slots reachable, rear-wall interiors unreachable, repeat placement immutable.
- Final root `npm test`:531pass/0fail, exit0.
- Final root `npm run lint`, `npm run build`, `git diff --check`:exit0. The normal app build retains the old student route intentionally until the later atomic cutover; the new component was separately compiled and actually run by Vite in this fixture.

## Adversarial coverage

Malformed inputs: rejected page0/invalid world inputs. Untrusted text: literal HTML-like author, no execution. Cancel/resume: slot cancellation and focus return preserve draft. Stale state: source hashes before/after capture match; old failed captures are not completion evidence. Dirty worktree: discarded draft deletion and unrelated edits retained. Long commands: browser runs bounded, final processes terminated. Timing/flaky behavior: independent repeat of actual movement and tab focus paths. Misleading success: a531-test pass did not waive observed focus/visual failures; final behavior assertions and screenshots required. Interruptions: real tab blur and held-key return explicitly exercised.

## Cleanup

- All root and worker-owned isolated Chrome contexts closed.
- Root IAB viewport override reset and owned tab3 closed.
- Root Vite session9999 terminated with Ctrl-C, exit130. Root lsof confirmed no listeners on3021,3022,3023 after worker cleanup.
- No student data, production server, Supabase state, dependency, migration, commit, push, or deployment changed.
