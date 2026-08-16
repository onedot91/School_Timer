# Manual QA — glass Goma replacement in Teacher Settings Shop

Read-only visual QA for the supplied glass-looking replacement. The live app was opened at `http://127.0.0.1:3000` in Chrome at 1366×900. Navigation and scroll were the only browser actions; no student or teacher data was changed.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| GLASS-SV-001 | Supplied replacement must render as the `유리 고마` catalog thumbnail | Web — Teacher Timer > 설정 > 상점 > 고마 스킨 도감; 1366×900 | `agent-browser open http://127.0.0.1:3000`; unlock 0 five clicks; click `0번 학급 시계 선택` → `설정` → `상점`; `agent-browser screenshot .../teacher-shop-glass-live-scrolled2.png`; `view_image(path=.../teacher-shop-glass-live-scrolled2.png)` | PASS | G1, G2, G3, G4 |
| GLASS-SV-002 | Thumbnail must be legible and not clipped inside its card | Web — scrolled `고마 스킨 도감` grid, `유리 고마` card | Read-only `agent-browser eval` querying `.teacher-shop-skin-list article` and its `img`/`span` boxes; capture `teacher-shop-glass-live-scrolled2.png` | PASS | G1, G2, G3 |
| GLASS-SV-003 | Catalog integration must use the intended asset and retain the full catalog count | Web — `고마 스킨 도감` heading/count and card DOM | `agent-browser snapshot -c -d 8`; read-only DOM eval for the `유리 고마` article; source `nl -ba src/lib/studentEconomy.ts | sed -n '58,90p'` | PASS | G1, G3, G5 |
| GLASS-SV-004 | Scrolling to the late catalog row must keep the card inside the dialog | Web — settings body plus `.teacher-shop-skin-list` internal scroll | Read-only eval setting `.teacher-shop-skin-list.scrollTop=400` and `.settings-body.scrollTop=430`; `agent-browser screenshot .../teacher-shop-glass-live-scrolled2.png` | PASS | G1, G2, G3 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| GLASS-ADV-001 | Visual fidelity / asset path | missing or stale image asset | `유리 고마` must resolve to `/goma-skins/glass-goma.png`, load successfully, and expose nonzero natural dimensions | PASS | G1, G3, G5 |
| GLASS-ADV-002 | Layout safety | narrow card / overflow | The 48×48 image and Korean label must remain within the 146.734×67.187 card, with no crop, baseline clipping, orphan glyph, or overlap | PASS | G1, G3 |
| GLASS-ADV-003 | Transparency/glass appearance | opaque matte or black-fill regression | Rendered card should show a clear/glass-looking white bear with visible outline/details and no contrasting rectangular matte on the white card | PASS (visual surface) | G1, G2, G3 |
| GLASS-ADV-004 | CJK precision | Korean label wrapping | `유리 고마` must remain a single readable line under `word-break: keep-all` | PASS | G1, G3 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| G1 | screenshot | Fresh live Teacher Settings > Shop capture at 1366×900; heading/count and top of catalog | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-skin-catalog/teacher-shop-glass-live.png` |
| G2 | screenshot | Fresh live scrolled capture at 1366×900; full late-row cards including `유리 고마` | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-skin-catalog/teacher-shop-glass-live-scrolled2.png` |
| G3 | action log | Browser invocations, DOM box measurements, and evidence integrity checks | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-skin-catalog/glass-goma-visual-qa-actions.txt` |
| G4 | reference screenshot | Supplied replacement reference capture showing the white/transparent-looking `유리 고마` thumbnail | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/goma-skin-catalog/glass-goma-replacement.png` |
| G5 | source/asset | Catalog mapping and supplied replacement asset | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:80`; `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/public/goma-skins/glass-goma.png` |

## verdict

PASS. The live `유리 고마` thumbnail matches the supplied clear/glass-looking white-bear design, is fully visible at 48×48 with `object-fit: contain`, and its Korean label remains one line inside the card. The source PNG is RGB/no native alpha, but the white background merges with the white catalog card and no visible matte or clipping appears in the rendered surface.
