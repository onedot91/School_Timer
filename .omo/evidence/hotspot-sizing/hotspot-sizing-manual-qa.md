# Manual QA: hotspot sizing

Verdict: PASS

Read-only browser QA of `http://127.0.0.1:3000` at `1280×720`. No control that mutates balances, bids, awards, or student data was clicked; only direct hash navigation, keyboard focus, DOM measurement, and screenshots were used.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S-OVERVIEW | C1 mailbox target sizing; C3 focusability; C4 overflow | Browser UI, `#student-overview` / active `overview` | `viewport.set({width:1280,height:720})`; `tab.goto('http://127.0.0.1:3000/#student-overview')`; `reload()`; `getByRole('button',{name:'우편함 열기'}).press('Tab')`; read `activeElement.getBoundingClientRect()` and document widths; screenshot | PASS | A-OVERVIEW, A-MEASUREMENTS |
| S-STORE | C2 donation character/hotspot; C3 focusability; C4 overflow | Browser UI, `#student-store` / active `store` | `tab.goto('http://127.0.0.1:3000/#student-store')`; `getByRole('button',{name:'기부하러 이동'}).press('Tab')`; read hotspot/image rectangles, `:focus-visible`, and document widths; screenshot | PASS | A-STORE, A-MEASUREMENTS |

Measured/observable evidence:

- Mailbox hotspot: `131.625×184.719px`, exactly `18%` of the `733.25px` stage width; it stays localized over the mailbox and does not extend into the adjacent character/library area. `tabIndex=0`; focused outline is `3px solid rgb(0,122,87)`.
- Donation hotspot: `236.406×186.023px`; character: `200×159.742px` (`84.6%×85.9%` of target). Character center matches target center with `0px` horizontal and vertical delta, visibly centered in the empty lot.
- Both surfaces: `document.scrollWidth=1280` and `body.scrollWidth=1280` at a `1280px` viewport; no horizontal overflow observed.

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| AC-01 | C1 | oversized mailbox hotspot | Mailbox target remains a localized, non-overly-wide hit area at desktop size. | PASS | A-OVERVIEW, A-MEASUREMENTS |
| AC-02 | C2 | oversized or miscentered donation character | Character is smaller than its target, centered in the empty lot, and the target closely fits it. | PASS | A-STORE, A-MEASUREMENTS |
| AC-03 | C3 | keyboard-only focus | Mailbox and donation targets are keyboard focusable and show a visible focus indicator. | PASS | A-OVERVIEW, A-STORE, A-MEASUREMENTS |
| AC-04 | C4 | horizontal overflow | Neither desktop surface creates horizontal scrolling beyond the viewport. | PASS | A-OVERVIEW, A-STORE, A-MEASUREMENTS |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A-OVERVIEW | screenshot | Fresh 1280×720 overview with mailbox keyboard focus visible; PNG signature verified. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/hotspot-sizing/actual-overview-mailbox-focus-valid.png` |
| A-STORE | screenshot | Fresh 1280×720 store plaza with donation target keyboard focus visible; PNG signature verified. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/hotspot-sizing/actual-store-donation-focus-valid.png` |
| A-MEASUREMENTS | data | Browser DOM measurements, focus state, and overflow checks for both surfaces. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/hotspot-sizing/hotspot-sizing-measurements.json` |
