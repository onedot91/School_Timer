# Bookshop ambient implementation

Contract: implement the accepted six interaction types (lamp, two plants, bench, table book, cat, tea). Session-only state; no persistence/rewards/new audio/dependencies. Preserve 100 slot IDs and all existing bookshelf flows.

Final user layout correction: spread objects out. Cat rests on the open central floor; tea sits on the right side of the existing registration desk. No separate table, shelf, or additional collider. Reading corner retains book/lamp/seating. Empty/full reachability was rechecked after this change.

- completed: world definitions and pure state transitions; pixel actions and visit-state input integration.
- completed: development QA controls, state/selection/reachability regressions, lint/tests/build (722 tests passed).
- completed: actual 1280×800 interaction scenarios, before/after pictures, recorded play; independent visual and input review. Evidence: ../evidence/bookshop-ambient/QA.md.

Gates: every target reachable in empty/full room; E/click cue and single target; no overlapping actions or book loss; bench escape/movement exit; final states/reset/blur/reduced motion correct; attached props and correct draw depth; no new sounds; screenshots and actual recording; no overflow.
