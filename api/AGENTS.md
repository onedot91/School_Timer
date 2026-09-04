# API SERVERLESS HANDLERS

## OVERVIEW

Vercel Node serverless boundary. Nine direct TypeScript handlers authenticate device sessions, enforce student/teacher scope, and call Supabase or the question service with server credentials.

## HANDLER MAP

| Handler | Contract |
|---|---|
| `announcement-notes.ts` | Teacher-only announcement note GET/PUT |
| `class-donation.ts` | Student/teacher class-donation RPC POST |
| `classword.ts` | Classword board, quiz, topic, round, and entry GET/POST router |
| `device-session.ts` | Device registration/session GET/POST/DELETE |
| `shared-settings.ts` | Scoped settings GET and optimistic-concurrency PUT |
| `student-economy.ts` | Idempotent student economy action POST |
| `today-friend.ts` | Today-friend student/teacher GET/POST router |
| `weekly-mission.ts` | Single weekly mission settlement POST |
| `weekly-missions.ts` | Batched weekly mission settlement POST |

## REQUEST BOUNDARY

- Treat guard order as behavior; preserve the sequence already established by the target handler.
- `class-donation`, `weekly-mission`, and `weekly-missions`: method -> cross-site -> configuration/session -> body/student scope -> rate limit where present -> external call.
- `classword` and `today-friend`: configuration -> session -> non-GET cross-site -> write rate limit -> GET/POST dispatch.
- `announcement-notes`: configuration -> session -> teacher role -> GET fast path; PUT method -> cross-site -> body -> upsert.
- `shared-settings`: configuration -> session -> GET fast path; PUT method -> cross-site -> body/size -> version conflict -> student scope -> compare-and-swap write.
- `student-economy`: configuration -> session -> POST method -> cross-site -> body/size -> student scope -> retrying compare-and-swap mutation.
- `device-session`: secret -> GET read; otherwise cross-site -> DELETE or POST method -> registration body -> rate limit -> registration authorization.
- Validate role and student-number ownership before any external mutation. Never trust a body/query student number over the signed device session.
- Apply `isCrossSiteRequest` to state-changing requests. Rate-limited responses set `Retry-After` and return `429` before external calls.
- Keep `Cache-Control: no-store` on session- or classroom-state responses.

## SECRETS AND UPSTREAMS

- `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_SESSION_SECRET`, and `DEVICE_REGISTRATION_KEY` are server-only. Never expose them through `VITE_*`, JSON, logs, or client imports.
- `SUPABASE_URL` may fall back to `VITE_SUPABASE_URL`; the service-role key has no client fallback.
- Supabase REST/RPC calls use `Authorization: Bearer <service role>` and `apikey`; retain explicit timeouts.
- Only weekly mission handlers call `https://question-news.vercel.app/api/student`; deployment rewrites and CSP/CORS live outside this directory.

## RESPONSE CONTRACTS

- `200` success payload; `204` successful deletion/upsert with no payload.
- `400` malformed JSON, invalid action, size cap, or domain validation failure.
- `401` missing/invalid device registration; `403` cross-site, role, registration-key, or student-scope rejection.
- `405` unsupported method; `409` optimistic-write conflict or missing shared row; `429` local rate limit.
- `500` unexpected in-process/domain routing failure; `502` upstream Supabase/service failure; `503` missing server configuration.
- Return stable `{ error: 'UPPER_SNAKE_CODE' }` bodies. Do not leak caught error text except allow-listed domain codes.

## CONVENTIONS

- Every deployable file exports `default function handler` or `default async function handler`.
- Relative ESM imports in this server graph must end in `.js`, even when the source file is `.ts`.
- Keep request/response structural types local; reusable auth, rate-limit, repository, and domain logic belongs in `src/server` or `src/lib`.
- Preserve input caps: shared settings value `1 MiB`; student economy request `8 KiB`.
- Adding a direct handler consumes the Vercel Hobby cap. `src/lib/vercelFunctionImports.test.ts` requires at most 12 `.ts` handlers and validates every one as deployable; add new server dependencies to `SERVER_MODULES` there.

## TESTS

- Handler tests live in `tests/api/<handler>.test.ts` and import production modules with explicit `.js` extensions.
- Use `node:test` plus `node:assert/strict`; invoke handlers directly with a small response recorder.
- Mock `globalThis.fetch`; assert rejected requests make no upstream call. Restore fetch and every changed `process.env` value in `finally`.
- Build signed teacher/student cookies with `createDeviceSessionToken`; use `sec-fetch-site: same-origin` for accepted mutations and explicit cross-site headers for rejection cases.
- Cover exact status/error codes, scope isolation, size limits, conflict paths, `Retry-After`, and external request shape.
- Target one file with `node --import tsx --test tests/api/<handler>.test.ts`; run `src/lib/vercelFunctionImports.test.ts` whenever handler files or server imports change.

## ANTI-PATTERNS

- No service-role access from browser code, student mutation outside signed-session scope, or balance/state mutation before authorization.
- No extensionless relative imports, permissive cross-site write fallback, swallowed optimistic conflicts, or new handler without the direct-function-cap test.
