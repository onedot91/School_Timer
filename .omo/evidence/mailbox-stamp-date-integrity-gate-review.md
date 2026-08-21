# Mailbox stamp/date integrity gate

- recommendation: APPROVE
- blockers: []
- originalIntent: Unopened mailbox envelopes show the stamp at the left edge and the date at the lower-right while concealing the sender; opened-letter rendering remains intact.
- desiredOutcome: An unread envelope exposes neither sender nor title in visible copy or its accessible name, has non-overlapping stamp/seal/date placement, and selecting/opening a letter still renders its title, body, sender signature, and stamp.
- userOutcomeReview: The supplied runtime capture shows the unread top envelope with only its left stamp, centered wax seal, and lower-right date. The sender/title are absent. The two opened envelopes show sender/title/date, and the selected letter reader shows title, body, bank stamp, and sender signature without visible overlap.

## Criteria checked

- C1 sender concealment on unread envelope: PASS. `StudentMailboxPage.tsx` renders no sender/title children when `isUnread`, and its unread `aria-label` is only `새 편지, <date>`.
- C2 stamp at left edge: PASS. `src/index.css` positions the normal stamp with `left: .62rem` and the bank stamp with `left: .24rem`; capture confirms placement.
- C3 date at lower-right: PASS. `.student-mail-envelope-copy time` uses `position: absolute; right: 0; bottom: 0`; capture confirms placement.
- C4 no layout overlap: PASS at the available 938x703 runtime capture. Stamp, wax seal, date, opened-envelope copy, and reader content are visually separated.
- C5 opened-letter rendering regression: PASS by code path and supplied capture. Read/open envelopes retain sender/title/date; selected reader retains title, body, signature, postmark, and reply behavior conditions.

## Direct programming / remove-ai-slops pass

- No sender data is placed in hidden unread-envelope descendants or the unread accessible name.
- The change uses existing letter fields and direct conditional rendering; no extra parsing/normalization or single-use production abstraction was introduced for this narrow follow-up.
- No deletion-only, tautological, implementation-mirroring, or requested-removal-only tests were added in the scoped diff.
- Note: exact 1280x800 primary visual verification is unavailable, as disclosed; this is not a blocker for the stated scoped acceptance criteria because the supplied 938x703 capture directly demonstrates the requested placements and no overlap at a narrower viewport.

## Checked artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMailboxPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/mailbox-stamp-left-date-bottom-final.png`
- `git diff -- src/components/student/StudentMailboxPage.tsx src/index.css`

## Evidence gaps

- No exact 1280x800 screenshot was available; runtime evidence is 938x703.
- No separate code-review report or manual-QA matrix for this narrow follow-up was present under `.omo/evidence/student-mailbox-post-office/`; direct gate inspection covers the requested criteria.
- `omo ulw-loop status --json` could not run because `omo` is not installed/on PATH, so the mandated fallback report location was used.
