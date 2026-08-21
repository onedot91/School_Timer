# Bookshelf natural-fidelity regression command results

Read-only execution on 2026-08-22 in `/Users/ibyeonghyeon/Documents/GitHub/School_Timer`.

## Focused unit test

Invocation: `node --test --experimental-strip-types src/lib/studentLife.test.ts`

Result: PASS — 8 tests passed, 0 failed, 0 skipped.

## Full test suite

Invocation: `npm test`

Result: PASS — 133 tests passed, 0 failed, 0 skipped. The suite emitted one expected error-path log for malformed weekly-mission evidence; the associated test passed.

## TypeScript validation

Invocation: `npm run lint`

Result: PASS — `tsc --noEmit` completed with no errors.

## Production build

Invocation: `npm run build`

Result: PASS — Vite transformed 2171 modules and built successfully. It emitted the existing non-blocking large-chunk warning (>500 kB).

## Focused formula/layout probe

Invocation: `node --import tsx --input-type=module -e "import {getBookSpineHeightPx,getBookStackLayout} from './src/lib/studentLife.ts'; ..."`

Result: PASS — heights are `15→27`, `30→36`, `37→40.2`, `45→45`; layout bounds are widths `81..92` and offsets `-1..1`; layout index 12 equals index 0.

## Artifact inventory check

Invocation: `file tmp/bookshelf-layout-fix-qa/* && wc -c tmp/bookshelf-layout-fix-qa/*`

Result: PASS — required PNGs are non-empty RGB PNGs at `1024×768`, `1280×800`, and `1366×768`.

## Runtime evidence limitation

No browser action log, DOM `getBoundingClientRect()` dump, or computed-style capture was supplied or reproduced in this environment. The exact reported center range (`9.38px`, previously `59.25px`) is therefore not independently verified; screenshots establish visual containment/readability only.
