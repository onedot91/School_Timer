# Manual QA — shared settings polling / entry lazy loading (`739de87`)

실행 대상: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer`, commit `739de87` (`ebe7fc6` 대비 변경).
데이터: `npm run dev`가 시작한 `VITE_DATA_MODE=mock` 앱과 disposable `globalThis.fetch` stub만 사용. 실제 학생/공유 backend 데이터는 사용하지 않음.

## 결과 요약

- Verdict: **FAIL (coverage blocker)**
- Confidence: **HIGH** for API, build, and exercised browser states; **MEDIUM** overall because the required exact 1280×800 browser check could not run.
- Executed: 26 scenarios; PASS 25, BLOCKED 1 (viewport prerequisite unavailable); FAIL 0.
- P0/P1 product blockers: none observed. Per manual-QA policy, the un-runnable required viewport case makes the overall QA verdict FAIL until a viewport-capable browser is available.

## `manualQa` matrix

### surfaceEvidence

| Scenario | Criterion | Surface | Exact invocation | Verdict | Artifact refs |
|---|---|---|---|---|---|
| API-01 | unauthenticated read rejected | HTTP handler | `node --import tsx --test tests/api/shared-settings.test.ts` → `unregistered devices cannot read shared classroom settings` | PASS | A1 |
| API-02 | concurrent metadata requests deduplicated | HTTP handler | same targeted test → `registered devices can poll only the shared settings timestamp`; two `GET ?metadata=1` via `Promise.all` | PASS | A1, A2 |
| API-03 | metadata response contains timestamp only | HTTP handler | same test; assert body `{updatedAt:'v2'}` and request URL has `select=updated_at`, no `value` | PASS | A1 |
| API-04 | metadata cache hit within 1s | HTTP handler | disposable stub: two sequential `GET ?metadata=1`, assert `fetchCalls===1` | PASS | A2 |
| API-05 | metadata cache expires after 1s | HTTP handler | disposable stub: wait 1050ms, third `GET ?metadata=1`, assert value changes `v1→v2`, `fetchCalls===2` | PASS | A2 |
| API-06 | write refreshes metadata cache | HTTP handler | disposable stub: teacher `PUT` with known `expectedUpdatedAt`, then metadata GET; returned timestamp equals write and no extra fetch | PASS | A2 |
| API-07 | student projected read is scoped | HTTP handler | targeted shared-settings test → `student sessions receive only their own large JSON map entries` | PASS | A1 |
| API-08 | teacher/full read remains complete | HTTP handler | targeted test → `teacher and explicit writable reads keep the complete settings row` | PASS | A1 |
| API-09 | student cannot alter teacher-owned settings | HTTP handler | targeted test → `student sessions cannot change teacher-owned settings` | PASS | A1 |
| API-10 | known teacher version avoids reread | HTTP handler | targeted test → `teacher update with a known version writes without rereading shared settings` | PASS | A1 |
| APP-01 | entry reset exposes teacher and students | browser UI | `Ctrl+Alt+Enter` on `http://127.0.0.1:3000/` | PASS | B1 |
| APP-02 | teacher entry navigates to timer | browser UI | click `0번 학급 시계 선택`; URL becomes `/`, teacher timer AX shows date/settings | PASS | B2 |
| APP-03 | student entry preloads and navigates | browser UI | click `1번 경매장 선택`; URL becomes `/#student-overview`; settled AX shows `학생 개요` | PASS | B3 |
| APP-04 | initial student screen has no unintended document overflow | browser UI | student overview; evaluate `innerWidth/innerHeight/scrollWidth/scrollHeight` | PASS | B4 |
| APP-05 | overview visual state | browser UI | settled screenshot after student entry | PASS | B3 |
| APP-06 | mailbox feature lazy route opens | browser UI | overview click `우편함 열기`; URL `/#student-mailbox`; AX heading `우편함` | PASS | B5 |
| APP-07 | emotion feature lazy route opens | browser UI | overview click `오늘의 감정 고르기`; URL `/#student-emotions`; AX exposes 36 radio buttons | PASS | B6 |
| APP-08 | emotion interaction survives lazy load | browser UI | choose `기쁘다`, enter event/self-message, click `기록하기` then `확인`; radio remains selected and confirmation closes | PASS | B7 |
| APP-09 | missions direct hash lazy route | browser UI | navigate `http://127.0.0.1:3000/#student-missions`; AX exposes daily/weekly missions | PASS | B8 |
| APP-10 | missions internal scroll is intentional | browser UI | mission page; evaluate overflow elements; `MAIN.student-mission-groups` client 497 / scroll 938, document remains 605 | PASS | B9 |
| APP-11 | store plaza and store tabs survive lazy load | browser UI | navigate `/#student-store`; click `상점으로 이동`; click `고마 스킨 뽑기`, `집`; selected tab and panels update | PASS | B10 |
| APP-12 | student store internal scroll / no horizontal overflow | browser UI | store page; evaluate dimensions and `.student-shop-items-panel` client 417 / scroll 1690; document width equals viewport | PASS | B11 |
| APP-13 | teacher settings remains usable | browser UI | teacher timer click `설정`; AX dialog exposes settings functions and schedule table | PASS | B12 |
| APP-14 | teacher settings nav and mission panel | browser UI | settings click `미션`; AX shows mission checkboxes/start-number controls | PASS | B13 |
| APP-15 | teacher timer settled layout | browser UI | close settings; screenshot and evaluate dimensions | PASS | B2, B14 |
| APP-16 | exact 1280×800 student layout contract | browser UI | attempted via available CUA in-app browser; evaluate viewport | FAIL (missing prerequisite) | B15 |

### adversarialCases

| Scenario | Criterion | Adversarial class | Expected behavior | Verdict | Artifact refs |
|---|---|---|---|---|---|
| ADV-01 | metadata polling | concurrent duplicate requests | one upstream timestamp request, both callers receive same result | PASS | A2 |
| ADV-02 | metadata polling | stale cache after TTL | request after 1s performs fresh upstream read | PASS | A2 |
| ADV-03 | metadata polling | write/read ordering | successful write makes immediate metadata read return write timestamp | PASS | A2 |
| ADV-04 | API boundary | malformed body / oversized payload | 400 and no upstream fetch | PASS | A3 |
| ADV-05 | API boundary | cross-site PUT | 403 `CROSS_SITE_REQUEST_BLOCKED`, no upstream fetch | PASS | A3 |
| ADV-06 | API boundary | unregistered / wrong method | 401 / 405 before upstream fetch | PASS | A3 |
| ADV-07 | lazy routes | direct deep hash | direct `#student-missions` and `#student-store` render their intended feature, not entry reset | PASS | B8, B10 |
| ADV-08 | CJK/layout | Korean text and dense controls | no observed glyph loss/overlap; internal feature panels scroll within app | PASS | B3, B6, B8, B11 |

## Artifact refs

| ID | Kind | Description | Path |
|---|---|---|---|
| A1 | test-output | Targeted shared-settings handler suite, 16/16 pass | `.omo/evidence/shared-settings-polling-lazy-load-qa/shared-settings-test-output.txt` |
| A2 | command-output | Disposable stub exercising concurrent dedupe, 1s TTL, write cache refresh | `.omo/evidence/shared-settings-polling-lazy-load-qa/metadata-cache-command-output.txt` |
| A3 | command-output | Disposable stub exercising 401/405/400/403/oversize rejection with zero upstream calls | `.omo/evidence/shared-settings-polling-lazy-load-qa/adversarial-api-command-output.txt` |
| A4 | command-output | `npm run lint`, `npm test` (507/507), `npm run build`; build chunk listing | `.omo/evidence/shared-settings-polling-lazy-load-qa/verification-command-output.txt` |
| B1 | browser-action-log | Reset shortcut and entry grid AX state | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-entry-log.txt` |
| B2 | browser-action-log | Teacher entry/timer AX, screenshot observation, dimensions | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-teacher-log.txt` |
| B3 | browser-action-log | Student overview AX, screenshot observation, dimensions | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-student-overview-log.txt` |
| B4 | browser-metrics | Student overview `1075×605`, document `1075×605` | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-student-overview-log.txt` |
| B5 | browser-action-log | Mailbox route AX and `1075×605` dimensions | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-mailbox-log.txt` |
| B6 | browser-action-log | Emotion route AX and screenshot observation | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-emotion-log.txt` |
| B7 | browser-action-log | Emotion record confirmation and selected-state AX | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-emotion-interaction-log.txt` |
| B8 | browser-action-log | Missions direct-hash AX | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-missions-log.txt` |
| B9 | browser-metrics | Missions inner `MAIN` scroll metrics | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-missions-log.txt` |
| B10 | browser-action-log | Store plaza and store tabs AX | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-store-log.txt` |
| B11 | browser-metrics | Store panel scroll metrics and document width | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-store-log.txt` |
| B12 | browser-action-log | Teacher settings dialog AX | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-teacher-settings-log.txt` |
| B13 | browser-action-log | Teacher mission settings AX | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-teacher-settings-log.txt` |
| B14 | browser-metrics | Teacher timer `1075×605`, document `1075×605` | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-teacher-log.txt` |
| B15 | blocker | Exact 1280×800 unavailable in current CUA in-app browser; exposed viewport is 1075×605 and no override capability | `.omo/evidence/shared-settings-polling-lazy-load-qa/browser-viewport-blocker.txt` |

## Blocking issues

- P0/P1 product issues: none observed.
- P1 evidence blocker: exact 1280×800 viewport could not be run because the available CUA in-app browser exposes only `innerWidth=1075`, `innerHeight=605` and no viewport-control API. All exercised states were checked for document overflow at the available viewport; rerun B15 in a viewport-capable browser before release sign-off.
