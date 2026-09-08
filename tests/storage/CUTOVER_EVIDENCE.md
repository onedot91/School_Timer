# Storage v2 production cutover — 2026-09-08

## Release

- Production: https://school-timer-five.vercel.app
- Deployment: `dpl_J7Zh9asQtzmNFQhYtVCSDo6gHpdd`
- Immutable deployment URL: https://school-timer-p7isn67dk-onedot9191s-projects.vercel.app
- Source baseline: `61392ad`; storage changes overlaid in `/tmp/school-storage-release`. Concurrent student-house assets and unrelated economy/CSS changes were excluded. Only the two storage mail-compose CSS rules were included.
- `STORAGE_PROTOCOL_VERSION=2` is saved as a plain configuration variable for production and preview.
- Four SQL migrations installed through the existing Supabase connector: core, Today Friend, rewards, Classword. Maintenance was held during dedicated-table migration, backup, bootstrap, activation, and deployment verification.

## Data preservation

- Bootstrap: 23 wallets, 1,074 resources, 2,761 historical ledger entries.
- Exact canonical projection match against the original main row; all 23 balances unchanged.
- Canonical source SHA-256: `4a7527e0e97af645a30f54c77fb85b09e9051d662b4e907a146f007772ed4b02`.
- Original main row and all 11 related tables matched the private backup after deployment. Wallet reconciliation returned no mismatches. New receipts remained zero before reopening.
- Immutable database backup retained. Local private backup and hash manifest: `/tmp/school-storage-production-backup-20260908` (directory 0700, files 0600). Student contents and credentials are not included in this report.
- No live student payment, bid, donation, reward, or reversal was used as QA.

## Verification

- Final release `npm test`: 996 passed, 0 failed. Earlier runs intermittently failed the pre-existing loading-class assertion; no test was weakened. The final complete run passed.
- `npm run lint`: passed. Vite build and final Vercel production build: passed.
- Actual PostgreSQL/HTTP test: 23 student sessions and one teacher saved concurrently; all 24 returned 200. Nine scenarios covered wallet races, scoped responses, duplicate requests, lost responses, and stale teacher state; reconciliation had zero mismatches.
- Actual emitted Node ESM import: 78 modules and all 10 API handlers loaded successfully. Added a transitive import regression test after the first deployment exposed six extensionless imports in two newly server-used domain files. Corrected before reopening.
- Browser: student emotion save persisted across reload with the expected fixture balance; teacher subject edit persisted across reload. Device drafts survived failed saves and reload, and explicit retries confirmed/cleared them. Student/teacher surfaces checked at 1280×650, 1280×600, and 1280×800. Only disposable fixture data was changed.
- Final production API: teacher full snapshot HTTP 200, exact original data match, 23 wallets; student 17 response HTTP 200 with only own balance/history keys; empty legacy request rejected with HTTP 409 `STORAGE_PROTOCOL_REQUIRED` before storage.
- Actual response region: `icn1::icn1`. Teacher snapshot read measured 431 ms for this verification request.
- Independent code review: CLEAR / APPROVE; follow-up import/timestamp review 29 focused tests passed.

## Operational note

Storage reopened at `2026-09-08T06:40:15.409540Z` (15:40 KST): `active=true`, `maintenance=false`.

Previously open clients must reload to use protocol v2. Old clients cannot overwrite the new store. Unconfirmed operations preserve their request identity and require explicit confirmation/retry; drafts are retained on the device. No offline transaction replay was introduced.
