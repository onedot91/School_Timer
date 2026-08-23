# Shared Balance Header — Clone / Design-System Fidelity Review

**Recommendation:** APPROVE

## Scope and target

Target: make the student store balance header less wasteful by narrowing the
reserved-balance block, and render that same compact balance header in missions.
The available target is the existing store header plus the requested cross-screen
consistency; no external image/reference design was supplied.

## Artifacts inspected

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBalanceSummary.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentHeader.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-balance-20260824/store-1024.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-balance-20260824/store-1280.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-balance-20260824/store-1366.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-balance-20260824/missions-1024.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-balance-20260824/missions-1280.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-header-balance-20260824/missions-1366.png`

`npm run lint` (`tsc --noEmit`) passed.

## Findings

### CRITICAL

None. The balance surface is live React DOM from the reused
`StudentBalanceSummary` primitive, not an image, screenshot, or CSS background
substitute. Missions supplies that same primitive at
`/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx:95`.

### HIGH

None. The header geometry is shared rather than copied: store and missions are
intentionally combined in the same CSS selectors at
`/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16249` and
`/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16275`.

### MEDIUM

None. `--student-header-reserved-width` is documented in
`/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:99`, defined on
the student shell at `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:18943`,
and drives both desktop and Chromebook header rules. The narrower width is a
shared semantic token, not a page-local one-off.

### LOW

None. All supplied store and missions captures preserve the same header layer
order: back action/title, available-balance primary group, then visibly smaller
reserved-balance group. The groups remain legible without overlap at the
captured 1024, 1280, and 1366 declarations.

## Visual-evidence limitation

The supplied files are rendered at approximately 84% browser preview scale:
the declared 1280 capture is 1075x672 pixels (and the 1024/1366 captures are
860x672/1147x672). They support visual consistency and clipping assessment,
but do **not** establish pixel-exact fidelity at a 1280x800, 100% browser
preview. No such claim is made here.

## Conclusion

PASS for this scoped change. The store and mission views share one live balance
primitive and one compact reserved-width token; the observed layout is
consistent and no material design-system or fidelity issue remains.
