# Asset and behavioral evidence

## Assets

The three requested assets were inspected visually and parsed from their PNG IHDR:

- `public/donation-character-1.png`: `1254x1254`, 8-bit, color type 6, alpha=true.
- `public/donation-character-2.png`: `1254x1254`, 8-bit, color type 6, alpha=true.
- `public/donation-character-3.png`: `1254x1254`, 8-bit, color type 6, alpha=true.

All three contain the character and its speech bubble as one transparent image asset. No separate green `기부` copy is present in the `StudentPlaza` donation button.

## Source and test verification

- `src/components/student/StudentPlaza.tsx:18` selects one source from the Korean local date; `:34-41` renders one donation button with one image and no text node.
- `src/lib/dailyDonationCharacter.ts:7-12` deterministically hashes the date key and selects among exactly three sources.
- `src/index.css:14682-14693` places the donation hotspot in the lower-right lot and sizes the image up to `17rem x 16rem` with `object-fit: contain`.
- Invocation: `node --import tsx --test src/lib/dailyDonationCharacter.test.ts` -> 2 tests passed, 0 failed; same-date stability and three-date cycling both passed.
- Invocation: `npm run lint` -> `tsc --noEmit` exited 0.
