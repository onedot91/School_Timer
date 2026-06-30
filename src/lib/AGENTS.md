# LIB KNOWLEDGE BASE

## OVERVIEW

`src/lib` contains shared state normalization, persistence adapters, auction math, character metadata, and browser audio helpers.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Supabase shared settings | `supabaseSettings.ts` | `app_settings` and `announcement_notes` client functions. |
| Random draw state | `randomDraw.ts` | Types, normalization, hidden queue, audio, localStorage helpers. |
| Auction/currency rules | `currency.ts` | Balances, bids, awards, weekday item visibility, clamping. |
| Auction audio | `auctionAudio.ts` | Web Audio synthesis for start, bid, final feedback. |
| Student character assets | `studentCharacters.ts` | Public asset paths and walking metadata. |

## CONVENTIONS

- Treat all persisted data as `unknown` until normalized. Supabase and localStorage payloads can be stale.
- Keep exported constants stable when pages use them as storage or compatibility contracts.
- Clamp numeric user input through lib helpers before page code writes it back.
- Browser audio helpers should fail silently for autoplay/device limitations; sound is decorative feedback.
- Public asset paths start at `/` and must match files under `public/`.

## ANTI-PATTERNS

- Do not throw from optional Supabase helpers when env vars are absent; no-env mode is supported.
- Do not change `SHARED_SETTINGS_ID` without a migration plan for existing Supabase rows.
- Do not widen currency or draw types with unchecked casts. Add normalization instead.
- Do not add new auction item ids without checking `TimerPage.tsx`, `AuctionPage.tsx`, and existing saved state.
- Do not make audio functions required for core flows; browser audio can be blocked.

## VERIFICATION

- Run `npm run lint` after changing any exported type or helper.
- Run `npm run build` when changing env access, asset paths, or imports used by pages.
