# Browser visual QA action log

- Surface: local web app, student plaza (`http://localhost:3000/#student-store`)
- Invocation V-1024: viewport `1024x768`; reload; observed existing `#student-store` route; inspected DOM; captured `browser-donation-1024.jpg`.
- Invocation V-1280: viewport `1280x900`; reload; observed existing `#student-store` route; inspected DOM; captured `browser-donation-1280.jpg`.
- Navigation used to establish the route: student overview -> button `경매장·기부 보기`; no balance, bid, award, or donation mutation controls were invoked.
- V-1024 observed image source after reload: `/donation-character-3.png`.
- V-1280 observed image source after reload: `/donation-character-3.png`.
- Explicit reload stability check at 1280: before `/donation-character-3.png`; after `/donation-character-3.png`.
- 1280 DOM geometry: donation hotspot `x=781.84, y=521.58, w=401.89, h=265.74`; character image `x=846.78, y=527.77, w=272, h=253.35`.
- 1280 donation button `textContent` was empty and its only child was the image; visible page text contained no detached `기부` label.

Capture hygiene: Browser returned JPEG bytes, so the fresh captures are stored with `.jpg` extensions. `file` verified both as JPEG, `1024x768` and `1280x900` respectively.
