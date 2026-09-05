# Library competition manual QA

수행일: 2026-09-05 20:17 KST  
환경: real Chrome headless, viewport `1280×800`, isolated context 1개씩 6회  
정확한 invocation: `node --import tsx .omo/evidence/library-competition/state-qa.mjs`  
Fixture 주의: 실제 `LibraryCompetitionPanel` / `TeacherLibraryCompetitionPanel`을 렌더링했고, 각 page realm 안에서만 `libraryCompetitionClient` singleton 메서드를 임시 주입했다. 모든 `/api/*` 및 외부 요청은 실행하지 않았으며 synthetic response만 사용했다.

## manualQa.surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S-LOAD | competition state loading | Student `LibraryCompetitionPanel` modal | `node --import tsx .omo/evidence/library-competition/state-qa.mjs` (`?surface=student&state=loading`) | PASS | `A1`, `A7` |
| S-ERR | SQL-missing/unavailable error | Student `LibraryCompetitionPanel` modal | `node --import tsx .omo/evidence/library-competition/state-qa.mjs` (`?surface=student&state=unavailable`) | PASS | `A2`, `A7` |
| S-INACTIVE | inactive read-only state | Student `LibraryCompetitionPanel` modal | `node --import tsx .omo/evidence/library-competition/state-qa.mjs` (`?surface=student&state=inactive-readonly`) | PASS | `A3`, `A7` |
| T-LOAD | competition state loading | Teacher `TeacherLibraryCompetitionPanel` | `node --import tsx .omo/evidence/library-competition/state-qa.mjs` (`?surface=teacher&state=loading`) | PASS | `A4`, `A7` |
| T-ERR | SQL-missing/unavailable error | Teacher `TeacherLibraryCompetitionPanel` | `node --import tsx .omo/evidence/library-competition/state-qa.mjs` (`?surface=teacher&state=unavailable`) | PASS | `A5`, `A7` |
| T-INACTIVE | inactive state | Teacher `TeacherLibraryCompetitionPanel` | `node --import tsx .omo/evidence/library-competition/state-qa.mjs` (`?surface=teacher&state=inactive`) | PASS | `A6`, `A7` |

관찰 결과: 학생 loading은 `aria-busy=true`, 로딩 문구, disabled refresh를 표시했다. 학생 unavailable은 SQL 누락에 해당하는 사용자 메시지를 표시했고, inactive-readonly는 빈 순위판 안내·Escape 닫기·canvas focus 복귀·write call 0건을 확인했다. 교사 loading은 busy 문구와 disabled refresh를 표시했고, unavailable은 동일한 복구 메시지를 표시했으며, inactive는 시작 안내·입력 필드 0개·write call 0건이었다. 여섯 캡처를 직접 열어 확인했고, 모두 1280×800 PNG이며 문서 overflow가 없었다.

## manualQa.adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| S-LOAD | loading state | delayed/unresolved read | Modal remains usable, shows loading status, and refresh is disabled while read is pending. | PASS | `A1`, `A7` |
| S-ERR | SQL-missing/unavailable | backend schema unavailable | Convert client error to Korean recovery message; do not expose stack/error object. | PASS | `A2`, `A7` |
| S-INACTIVE | inactive readonly | empty/null competition state | Show inactive guidance, no standings/table, and keep underlying book surface usable after close. | PASS | `A3`, `A7` |
| S-INACTIVE | modal interaction | Escape/focus restoration | Escape closes the modal and restores focus to the supplied canvas target. | PASS | `A3`, `A7` |
| S-INACTIVE | write safety | forbidden write in read-only inactive mode | No `settings` client call is made. | PASS | `A3`, `A7` |
| T-LOAD | loading state | delayed/unresolved read | Teacher panel remains busy, shows loading status, and disables latest-value refresh. | PASS | `A4`, `A7` |
| T-ERR | SQL-missing/unavailable | backend schema unavailable | Show Korean recovery message and retain latest-value affordance for retry. | PASS | `A5`, `A7` |
| T-INACTIVE | inactive state | null competition state | Show start-on-first-open guidance and render no editable school count fields. | PASS | `A6`, `A7` |
| T-INACTIVE | write safety | forbidden write before activation | No `settings` client call is made. | PASS | `A6`, `A7` |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot PNG | Student loading modal at 1280×800 | `.omo/evidence/library-competition/state-qa-student-loading.png` |
| A2 | screenshot PNG | Student unavailable/SQL-missing message | `.omo/evidence/library-competition/state-qa-student-unavailable.png` |
| A3 | screenshot PNG | Student inactive-readonly message before Escape; focus restoration verified by script | `.omo/evidence/library-competition/state-qa-student-inactive-readonly.png` |
| A4 | screenshot PNG | Teacher loading panel at 1280×800 | `.omo/evidence/library-competition/state-qa-teacher-loading.png` |
| A5 | screenshot PNG | Teacher unavailable/SQL-missing message | `.omo/evidence/library-competition/state-qa-teacher-unavailable.png` |
| A6 | screenshot PNG | Teacher inactive panel with no editable fields | `.omo/evidence/library-competition/state-qa-teacher-inactive.png` |
| A7 | JSON receipt | Six screenshots, PNG signatures/dimensions, overflow, page errors, blocked requests, client calls, cleanup, and sourceStart/sourceEnd hashes (`sourceHashesEqual=true`) | `.omo/evidence/library-competition/state-qa.json` |
| A8 | fixture source | Isolated fixture importing actual components and injecting synthetic client methods | `.omo/evidence/library-competition/state-qa-fixture.tsx` |
| A9 | QA script | Exact invocation and browser automation scenario driver | `.omo/evidence/library-competition/state-qa.mjs` |

## Final verdict

`manualQa`: PASS. All requested six real browser scenarios ran; no case was skipped or inferred. Synthetic fixture scope is explicit and this is UI-state evidence only, not server integration proof. Production source hashes were identical before and after the pass, and isolated Chrome/context were closed while the root-owned `127.0.0.1:3044` server was retained.
