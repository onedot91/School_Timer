# Goma gacha verification · 2026-09-05

Scope: actual Gacha/Reveal components, existing domain action, student-economy API. Unrelated library work preserved. No production balances used.

## Automated
- npm run lint: exit 0.
- npm test: exit 0, 753 passed, 0 failed (final full run).
- npm run build: exit 0 after final CSS change.
- git diff --check: exit 0.
- Deterministic API retry test: randomInt returns0 first and9 thereafter; exactly one call with10 required. CAS retry preserves double rewards and another student's concurrent balance change.
- Domain: all10 buckets, one double bucket, distinct unowned rewards, single100 charge, first equip, idempotent replay, final skin, full collection.

## Real browser
Disposable in-memory fixture tmp/gacha-qa/index.html on stable mock Vite3002, actual components/domain under StrictMode. No storage/backend writes.
- Viewed single and double opening/result. Purple/gold double stage reveals both cards together, both names visible, first-skin application message and confirmation fit.
- All five positions: handoff center dx=0,dy=0,size ratio=1. Floor and modal capsule URLs match (orange/red/brown/green/peach). One modal during transfer through result.
- Final five consecutive runs:5 calls, wallet2000→1500, owned0→6 (four singles, one double). Escape at sealed preserves grants and restores control focus.
- Last unowned skin with double roll:109→110 owned,1000→900 wallet, single reveal then full-collection disabled.
- Balance99 and full collection disable draws.
- Save delay6500ms holds caught capsule, no premature modal. False/rejected save makes one call, preserves wallet/ownership, restores controls.
- Unmount during delayed save: parent retains grant, no late modal; remount ready.
- Rapid input: one request/100 charge. Click/Enter/Space open. Escape locked during opening; sealed/result dismiss. Focus containment/return verified.
- Missing capsule plus both skin images shows named fallbacks without another request.
- Reduced fixture sets matchMedia before Motion import: single/double manual Space opening works, no particles/orbits, confirm focused,180ms fades.
- Final actual shop1280×800: document1280×800; machine top176,bottom788,left12,right1268. No overflow. Original mock balance461 retained. Final browser error log empty.

Restored original localhost3001 shop skin tab and reset temporary viewport. Screenshots inspected inline, no saved screenshot claimed. Desktop browser QA at Chromebook viewport, not physical Chromebook performance or live backend verification.
