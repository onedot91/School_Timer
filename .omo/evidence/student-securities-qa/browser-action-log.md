# Student securities manual QA — browser action log

Date: 2026-08-14 Asia/Seoul
Surface: local Vite app, student entry 1, read-only securities routes.

## S1 — portfolio route

- Invocation: start `npm run dev:stable` on the local Vite app; open `http://localhost:3003/#student-store-securities`; use the existing entry reset shortcut `Alt+Meta+Enter`; select `1번 경매장 선택`; reload at the same hash.
- Mutation safety: entry selection changes only the disposable entry-number selection. No balance, holding, buy, sell, or trade control was clicked.
- Observed URL: `http://localhost:3003/#student-store-securities`.
- Observed DOM: `내 투자`, `보유 종목 0개`, `지금 수익`, `지금 팔면 0 고마`, `내 종목`, `오늘의 오르내림`, and four stock summaries.

## S2 — market route

- Invocation: from S1, click the read-only navigation button `종목 사고팔기`.
- Mutation safety: navigation only; no trade control was clicked.
- Observed URL: `http://localhost:3003/#student-store-securities-trade`.
- Observed DOM: four `article` cards; each exposes ownership (`보유 0주`), `사는 값`, `오늘 결과`, `오늘의 소식`, a `1주 사기 · N 고마` control, and `지난 소식`.

## S3 — prior-news disclosure

- Invocation: on S2, click the first `지난 소식` disclosure button.
- Mutation safety: local disclosure state only; no balance or holding mutation.
- Observed DOM: `aria-expanded` became true and the card showed `아직 지난 소식이 없어요.` for the empty market profile.

## Screenshot capture note

- Browser screenshot API captures were written to `portfolio-empty-1280.png`, `trade-empty-1280.png`, and `trade-first-history-expanded-1280.png` in this directory. The files are non-empty but the backend encoded JPEG data at `1075×672`, so they are not valid 1280×800 PNG evidence.
