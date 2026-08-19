# Securities lower action panel — source audit

Date: 2026-08-19 Asia/Seoul
Surface: student securities lower action panel; read-only review only.

## Exact source checks

- `StudentInvestmentActionPanel.tsx:103-117` renders the panel with a selected-stock-specific `aria-label`, `aria-busy`, visible `선택 종목`/stock name, the `투자할 고마` label/input, and both `투자하기`/`투자금 찾기` buttons.
- `StudentInvestmentActionPanel.tsx:112` gives the number input `min`, `max`, `step`, `inputMode="numeric"`, and `aria-label="투자할 고마"`; the wrapping `<label>` also contains the visible label text.
- `StudentInvestmentActionPanel.tsx:77-81` gates actions by market closure, save state, amount validity/limits, available balance, and holding presence. The native `disabled` attribute is applied at `:112`, `:115`, and `:116`.
- `index.css:15310` and `:15617-15623` use explicit `stock amount actions` grid areas. The supplied DOM geometry reports the three controls contained with no overlap or horizontal overflow at 1024/1280/1366; input share is 26.9%/24.4%/24.9% respectively.
- `index.css:15314` uses `min-width: 0` and `overflow-wrap: anywhere` for the selected stock value, so `구름운수` remains inside its cell even when the name needs to wrap.

## Accessibility recheck

`index.css:15466` still resets the input's own outline, but the wrapper now has `.student-investment-input > div:focus-within` at `index.css:15465`, with accent border and a 3px accent-tinted ring. This restores a visible keyboard-focus indicator without requiring a live-data interaction. The browser-isolated `focus()` probe was unavailable, so this is source/cascade verification rather than a direct focus screenshot.

## Verification run

- `npm test -- --run`: PASS, 99 tests / 99 passed / 0 failed / 0 skipped.
- `npm run lint`: PASS (`tsc --noEmit`, exit 0).
- `npm run build`: PASS (Vite exit 0; existing chunk-size warning only).
- No browser navigation/reload and no investment control was invoked.
