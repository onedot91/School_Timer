# Task 6 shared Canvas browser QA

Final run: 2026-09-05, production Vite preview `http://127.0.0.1:3034`, synthetic backend `http://127.0.0.1:3036`, Chrome Playwright contexts 1, 23, and reciprocal read context 2, viewport 1280×800. The final build manifest matched all 250 `src/` + `api/` source files; source hashes were unchanged across the run.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| shared-registration | Canvas library entry | Browser UI | Student 1 and 23: `번호 선택` → `{n}번 경매장 선택` → navigate `#student-library-bookshelf` | PASS | `json-final`, `png-s1-reg`, `png-s23-reg` |
| shared-placement | Shared placement | Browser UI + synthetic API | Student 23: keyboard movement to desk/shelf, `E`, fill `책 제목=공유 검증 책`, `글쓴이=합성 작가`, `쪽수=120`, click `책 받기`, choose `빈자리 1` | PASS | `json-final`, `png-s23-carry`, `png-s23-placed` |
| shared-refresh-read | Cross-student refresh/read | Browser UI | Student 1 reload → keyboard walk to shelf → click `공유 검증 책`; Student 2 repeats for `충돌 보류 책` | PASS | `json-final`, `png-s1-other`, `png-s2-read` |
| conflict-draft | Occupied-slot conflict | Browser UI + synthetic API | Student 1 opens stale picker, opponent already owns slot 0, click `빈자리 1`, observe 409 message, retain carried draft | PASS | `json-final`, `png-s1-conflict` |
| retry-precommit | Network retry | Browser UI + synthetic API | Abort first PUT before commit, click same slot once more, assert same `requestId` and exactly 2 PUT attempts | PASS | `json-final`, `png-s1-precommit` |
| retry-postcommit | Ambiguous commit replay | Browser UI + synthetic API | Commit to synthetic DB, drop browser 200 response, retry same carried draft/slot, assert same `requestId`, one DB book | PASS | `json-final`, `png-s1-final` |
| input-and-escaping | Validation and literal metadata | Browser UI | Cancel draft; submit `쪽수=0`; place title `<b>합성</b>` and author `<script>합성</script>`; inspect details DOM | PASS | `json-final`, `png-s1-unsafe` |
| viewport-safety | Chromebook viewport safety | Browser UI | Every captured page at 1280×800; PNG signature/dimensions and document overflow assertions | PASS | `json-final`, all `png-*` refs |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| adv-slot-conflict | Concurrency | stale entry / conflicting placement | Winner remains visible after refresh; loser draft remains carried and can retry another slot | PASS | `json-final`, `png-s1-conflict` |
| adv-network-before-commit | Reliability | precommit network failure | Retryable error is shown; no duplicate write; retry reuses request ID | PASS | `json-final`, `png-s1-precommit` |
| adv-network-after-commit | Idempotency | dropped 200 after real commit | Replay with same request ID returns one authoritative book and one reward | PASS | `json-final`, `png-s1-final` |
| adv-untrusted-metadata | Security/content | untrusted literal metadata | Markup-looking title/author renders as text; no nested `<b>` element or execution | PASS | `json-final`, `png-s1-unsafe` |
| adv-malformed-pages | Validation | malformed page count | `0` rejected; no carried draft or backend PUT | PASS | `json-final`, `png-s1-conflict` |
| adv-cancellation | State retention | cancellation | Cancelled registration leaves no carried draft and no backend write | PASS | `json-final` |
| adv-interruption | Focus/motion | interruption / bounded interaction | Real keyboard walking and modal focus returned without runtime errors; all operations bounded by Playwright waits | PASS | `json-final`, `png-s1-reg`, `png-s1-final` |
| adv-readonly-ui | Data mode | readonly UI branch | N/A: final target is production shared preview; readonly boundary is covered by the separate adapter test lane, not this production surface | N/A | `json-final` |
| adv-dirty-tree | Integrity | dirty tree/source drift | Full 250-file manifest and before/after hashes match; QA wrote only `.omo/evidence` artifacts | PASS | `manifest-final`, `json-final` |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| `json-final` | JSON receipt | Final two-/three-context shared browser execution, DB IDs/balances/rewards, request receipts, source hash binding, and 10 screenshot refs | `.omo/evidence/canvas-library/task-6-shared-browser.json` |
| `manifest-final` | JSON manifest | Build-time SHA-256 manifest for 250 `src/` + `api/` files | `.omo/evidence/canvas-library/task-6-final-build-manifest.json` |
| `png-s1-reg` | PNG | Student 1 registered Canvas surface, 1280×800 | `.omo/evidence/canvas-library/task-6-shared-1-registered.png` |
| `png-s23-reg` | PNG | Student 23 registered Canvas surface, 1280×800 | `.omo/evidence/canvas-library/task-6-shared-23-registered.png` |
| `png-s23-carry` | PNG | Student 23 carrying a newly registered book | `.omo/evidence/canvas-library/task-6-shared-23-carrying-shared.png` |
| `png-s23-placed` | PNG | Student 23 placed shared book | `.omo/evidence/canvas-library/task-6-shared-23-placed-shared.png` |
| `png-s1-conflict` | PNG | Student 1 occupied-slot error with draft retained | `.omo/evidence/canvas-library/task-6-shared-1-conflict-draft-retained.png` |
| `png-s1-precommit` | PNG | Student 1 retryable precommit failure/retry state | `.omo/evidence/canvas-library/task-6-shared-1-precommit-retried.png` |
| `png-s1-other` | PNG | Student 1 reads Student 23's book after reload | `.omo/evidence/canvas-library/task-6-shared-1-other-student-details.png` |
| `png-s1-unsafe` | PNG | Literal untrusted metadata details | `.omo/evidence/canvas-library/task-6-shared-1-untrusted-metadata-details.png` |
| `png-s1-final` | PNG | Final shared library state after replay | `.omo/evidence/canvas-library/task-6-shared-1-shared-final.png` |
| `png-s2-read` | PNG | Student 2 reads Student 1's book after refresh | `.omo/evidence/canvas-library/task-6-shared-2-student1-details.png` |
| `cleanup-final` | text receipt | Owned 3034/3036 sessions and Playwright contexts terminated; port probes returned connection refused | `.omo/evidence/canvas-library/task-6-shared-browser-cleanup.txt` |
