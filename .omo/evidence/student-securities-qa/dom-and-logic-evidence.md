# Student securities DOM and isolated logic evidence

## Rendered DOM checks

- Portfolio route rendered one `내 투자 현황` region, one `내 종목` region, one `오늘의 오르내림` region, and four stock movement articles.
- Market route rendered four cards with ownership, prices, today news, trade control, and prior-news disclosure.
- Expanding prior news was read-only and rendered the empty-history state.

## Isolated fake-state check

Invocation (no browser storage and no real student state):

```text
node --import tsx -e "import {getDailyStockQuotes,upsertStudentStockMarketEntry,applyStudentEconomyAction} from './src/lib/studentEconomy.ts'; ..."
```

Observed output for a fake `sunny` market entry (`+4` today, `-2` prior day):

```json
{
  "quote": {
    "price": 15,
    "changeAmount": 4,
    "comment": "문구류가 잘 팔렸어요.",
    "history": [
      {"dateKey":"2026-08-13","changeAmount":4,"comment":"문구류가 잘 팔렸어요."},
      {"dateKey":"2026-08-12","changeAmount":-2,"comment":"비가 와서 손님이 줄었어요."}
    ]
  },
  "buy": {"wallet":85,"holding":1},
  "sell": {"wallet":104}
}
```

Source trace: `StudentSecuritiesPage.tsx:22-31` derives owned count, total profit, and current payout; `StudentStockMarketPage.tsx:32-74` derives ownership, news, buy/sell label, and prior reasons; `StudentStockTrend.tsx:17-24` maps positive/negative Goma amounts to `▲`/`▼`; `src/index.css:15088-15089` maps the two trend classes to the documented red/blue semantic tokens.

## Verification commands

- `npm test`: PASS, 71 tests.
- `npm run lint`: PASS, `tsc --noEmit`.
- `npm run build`: PASS; Vite build completed with only the existing large-chunk warning.
