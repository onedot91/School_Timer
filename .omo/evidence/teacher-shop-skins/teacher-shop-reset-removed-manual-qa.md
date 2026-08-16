# Manual QA — teacher Shop reset section removal

## Surface and invocation

Web surface: `TimerPage` teacher settings modal > `상점`, represented by the fresh 1075×672 PNG captures in this evidence directory. Read-only invocations used:

```text
view_image({path: "/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-reset-removed.png"})
view_image({path: "/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-reset-removed-bottom.png"})
view_image({path: "/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-reset-removed-end.png"})
view_image({path: "/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-reset-removed-catalog.png"})
file .omo/evidence/teacher-shop-skins/teacher-shop-reset-removed*.png
rg -n -i '학생 기록 초기화|2번 상점 구매 초기화|studentRecords|secondStudentShopPurchases|resetStudentRecords|resetSecondStudentShopPurchases' src/pages/TimerPage.tsx
```

No data-mutating Shop controls were clicked or invoked.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| TSR-001 | Teacher Shop must no longer render the `학생 기록 초기화` section or its reset buttons | Web — TimerPage settings modal > 상점 | `view_image({path: ".../teacher-shop-reset-removed.png"})`; `view_image({path: ".../teacher-shop-reset-removed-bottom.png"})`; source absence check with `rg -n -i '학생 기록 초기화|2번 상점 구매 초기화|studentRecords|secondStudentShopPurchases|resetStudentRecords|resetSecondStudentShopPurchases' src/pages/TimerPage.tsx` | PASS | E1, E2, E5 |
| TSR-002 | Remaining Shop UI must remain present and readable after removal | Web — 물품 상점 / 구매 현황 | `view_image({path: ".../teacher-shop-reset-removed.png"})` | PASS | E1, E5 |
| TSR-003 | Shop content must stay within the settings modal while scrolling through purchase rows | Web — Shop settings body and purchase list | `view_image({path: ".../teacher-shop-reset-removed-bottom.png"})`; `view_image({path: ".../teacher-shop-reset-removed-end.png"})`; source inspection of `.settings-body`, `.teacher-shop-student-list`, and `.teacher-shop-skin-list` overflow rules | PASS | E2, E3, E6 |
| TSR-004 | Existing skin catalog must remain reachable below the retained Shop sections | Web — `고마 스킨 도감` section | `view_image({path: ".../teacher-shop-reset-removed-catalog.png"})`; related catalog capture `view_image({path: ".../teacher-shop-skins.png"})`; source inspection of `shopSettingsPanel` | PASS | E4, E5, E6 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-TSR-001 | Removed reset controls | stale-label / stale-handler presence | Neither reset heading/button nor the removed action keys/handlers should remain in the rendered Shop surface or current TimerPage source | PASS | E1, E2, E5 |
| ADV-TSR-002 | Remaining Shop UI integrity | dense form/list layout | `물품명`, `가격`, `추가`, item rows, `판매 중`, `구매 현황`, and student rows remain readable without overlap | PASS | E1, E5, E6 |
| ADV-TSR-003 | Overflow safety | scroll boundary | Scrolled purchase rows remain clipped inside the modal/list bounds; content does not escape or widen the dialog | PASS | E2, E3, E6 |
| ADV-TSR-004 | CJK readability | Korean heading and label wrapping | `물품 상점`, `구매 현황`, and related subtitles remain legible with no orphan glyphs or clipped baselines | PASS | E1, E2, E5 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| E1 | screenshot | Fresh Shop top-state capture showing retained catalog/purchase UI and no reset section, valid RGB PNG 1075×672 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-reset-removed.png` |
| E2 | screenshot | Fresh scrolled purchase-list capture, valid RGB PNG 1075×672 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-reset-removed-bottom.png` |
| E3 | screenshot | Fresh end-state capture showing modal boundary remains intact, valid RGB PNG 1075×672 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-reset-removed-end.png` |
| E4 | screenshot | Related Shop skin catalog capture showing retained `고마 스킨 도감` UI | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-skins.png` |
| E5 | source | Current Shop render and retained sections; removed reset block is absent | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:8522` |
| E6 | source | Current settings-body and Shop overflow/grid rules | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:11080`; `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:17081` |

## Verdict

PASS. The fresh teacher Shop captures show no `학생 기록 초기화` section or reset buttons, while `물품 상점`, `구매 현황`, and the retained skin catalog remain part of the live Shop render. No clipping or modal escape was observed in the top, scrolled, or end captures.

## Findings

- [product] PASS — Reset section/buttons are absent from the rendered Shop surface; source contains no removed reset labels, action keys, or handlers.
- [product] PASS — Remaining catalog, purchase rows, and skin catalog are still rendered and readable.
- [evidence] PASS — All supplied captures are non-empty RGB PNGs at 1075×672; scroll-state captures remain within the modal bounds.
