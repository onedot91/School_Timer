# Teacher render regression

Root cause: 8bf7449 added strict canonicalStorageJson comparison to hydrated teacher settings. normalizeSavedRandomDrawState creates normal history objects with sourceEntryId: undefined. Strict storage canonicalization throws STORAGE_INVALID_JSON; TimerPage effect propagates to AppErrorBoundary.

Fix: serialize settings with the existing JSON wire semantics before canonical comparison. Undefined optional object fields disappear exactly as during persistence; object key order comparison remains stable. SQL/storage strict encoder unchanged.

Evidence: regression fixture with real random draw normalizer throws STORAGE_INVALID_JSON before fix; passes after. 1075 tests, tsc, build pass. Production-built actual TimerPage served locally with synthetic random draw history and isolated API: page renders, settings dialog opens, Wednesday auction item added, saved status observed, console error logs empty. Save-alert/reward audit fixture endpoints intentionally omit unrelated data and display unavailable warning; production service not used.

No production student writes. Earlier commit/push approval covers correction of this regression.

Deployment verified: commit 1a5f23ec7749d0a1f54db5991709ed8ede654313, Vercel success. Production root HTTP 200, index-BIfy6Oq7.js references TimerPage-BEgYA9wL.js; fetched TimerPage includes JSON wire normalization before canonical comparison. Unauthenticated shared-settings HTTP 401 DEVICE_REGISTRATION_REQUIRED as expected; region icn1. Details in deployment.json.
