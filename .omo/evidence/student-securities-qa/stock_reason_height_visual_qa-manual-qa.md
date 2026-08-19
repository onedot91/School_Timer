# Manual QA: securities reason-card height

Verdict: **FAIL — source contract is correct, but a current-build rendered PASS cannot be recorded under the no-browser constraint.**

The current CSS statically guarantees equal desktop reason-card heights and an internal scroll container at all three requested widths. The only supplied rendered screenshot is older than the current CSS and the requested 1024/1280/1366 rendered states were not freshly captured; keyboard/CJK zoom behavior also cannot be exercised without the prohibited browser interaction.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | SC-1 equal reason-card heights at 1024 CSS px | current source/CSS contract | `nl -ba src/index.css | sed -n '15479,15610p'`; inspect at media-query boundary and reason rule | PASS (static) — 1024 is covered by `min-width:64rem`; all four cards share the grid row and each reason uses the same `height:clamp(...)` | `A1`, `A2`, `A5` |
| S2 | SC-1 equal reason-card heights at 1280 CSS px | supplied 1280 screenshot plus current source/CSS | `view_image(/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-d6be9c7d-db01-4729-86ca-7fbef903d516.png)`; `nl -ba src/index.css | sed -n '15479,15596p'` | FAIL (rendered evidence) — screenshot is stale relative to current CSS, so it cannot prove the current 1280 render; source contract itself is PASS | `A1`, `A2`, `A3`, `A5` |
| S3 | SC-1 equal reason-card heights at 1366 CSS px | current source/CSS contract | `nl -ba src/index.css | sed -n '15479,15610p'`; evaluate same desktop rule at 1366 | PASS (static) — same media query and same fixed `clamp(...)` value apply; no width-dependent height branch exists | `A1`, `A2`, `A5` |
| S4 | SC-2 long reason text stays inside a bounded card and scrolls internally | current source + supplied screenshot | `nl -ba src/index.css | sed -n '15578,15596p'`; `view_image(/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-d6be9c7d-db01-4729-86ca-7fbef903d516.png)` | PASS (static/source) — fixed height, `overflow-y:auto`, `overscroll-behavior:contain`, and thin scrollbar are present; supplied image visibly shows a scrollbar on the long first reason, but image freshness limits current-build proof | `A1`, `A2`, `A3` |
| S5 | SC-3 no overlap, clipping, or CJK orphaning at requested widths | current source/CSS plus visual screenshot inspection | `nl -ba src/index.css | sed -n '15363,15374p;15578,15596p'`; `view_image(/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-d6be9c7d-db01-4729-86ca-7fbef903d516.png)` | FAIL (evidence completeness) — current source uses `word-break:keep-all`, `overflow-wrap:anywhere`, and `overflow:hidden` on the parent card, but no fresh 1024/1280/1366 captures exist to reject actual clipping/orphaning on the current build | `A1`, `A2`, `A3`, `A4` |
| S6 | SC-4 keyboard focus and CJK text-zoom safety | keyboard/browser UI | Browser keyboard/focus invocation intentionally not run per user constraint: no navigation, reload, or click | FAIL — missing prerequisite; source has `button` semantics and `.student-market-card:focus-visible`, but an interaction/zoom verdict cannot be inferred from CSS alone | `A2`, `A5` |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A1 | SC-1 | viewport breakpoint boundary (1024/1280/1366) | all three widths enter the same desktop rule and all four reason regions have one shared computed height | PASS (static contract) — `@media (min-width:64rem)` and one fixed `clamp(...)` declaration cover all three widths | `A1`, `A2` |
| A2 | SC-2 | long CJK reason content | text remains bounded and scrolls within the reason region instead of increasing card height | PASS (static contract) — `height` is fixed and `overflow-y:auto`; supplied screenshot shows the long-card scrollbar | `A1`, `A3` |
| A3 | SC-3 | CJK wrapping / extreme text zoom | no detached glyphs, clipped baselines, or overlap at each requested width and zoom state | FAIL — current source has defensive wrapping, but browser zoom/rendering cannot be exercised under the explicit no-navigation/reload/click restriction; missing prerequisite is a permitted browser capture | `A2`, `A3`, `A4`, `A5` |
| A4 | SC-4 | keyboard focus / scroll affordance | card receives visible focus and content remains operable without mouse mutation | FAIL — no keyboard interaction log may be produced under the explicit browser restriction; source-only focus rule is insufficient for a real interaction verdict | `A2`, `A5` |
| A5 | Evidence contract | stale/invalid capture | rendered evidence must be fresh, valid PNG, and match requested viewport | FAIL — supplied screenshot predates current CSS; existing width captures are JPEG payloads at 723×565, 903×565, and 964×565 rather than requested CSS dimensions | `A3`, `A4` |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | source | Desktop grid/card/reason CSS, including `height:clamp(...)` and `overflow-y:auto` | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15479` |
| A2 | source | Four-card JSX map; comment region and keyboard-focusable button surface | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx:48` |
| A3 | screenshot | User-supplied rendered securities screenshot (PNG, 2940×1846; modified before current CSS) | `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-d6be9c7d-db01-4729-86ca-7fbef903d516.png` |
| A4 | screenshot-integrity-log | Prior width-capture signature/dimension check showing JPEG payloads and invalid PNG diff | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-dedup-integrity-check.txt` |
| A5 | command-log | Current read-only verification: 99 tests pass, lint exit 0, build exit 0; includes evidence freshness timestamps | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/stock_reason_height-verification.log` |

## blocker

To convert the static/source PASS into a rendered PASS, obtain fresh 1024×, 1280×, and 1366× captures from the current build and an allowed keyboard/text-zoom observation. The user’s no-navigation/reload/click constraint prevents those scenarios in this attempt.

## QA execution note

The `visual-qa` skill's independent oracle dispatch could not be performed because no collaboration/spawn tool is exposed in this executor session. This is recorded as a process limitation, not treated as a PASS.
