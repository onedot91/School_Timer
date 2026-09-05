# Canvas library small-room art brief

This is a plan artifact, not an image or production asset. Applies to the first isolated playable room only. Whole-room screenshots are the acceptance surface; no isolated sprite approval substitutes for them.

## Composition
- Topdown, consistent shallow front faces, not isometric and not side-scrolling. Upper-left light on every object. Furniture has actual top, front lip, feet/contact shadow; the character's feet and collider share the same floor plane.
- 624×376 logical frame displayed at integer2x in a1280×800 window; reusable pixel drawing at logical1px. Frame may include a quiet dark perimeter, but not a large unused corridor or dark void swallowing half the view.
- Entry at lower-center; registration desk in left foreground; two distinct shelves offset along back/center; reading alcove at right, with table, bench, rug, lamp and window. Walking route is visible floor, not hidden behind objects.
- Common wood grain/corner joinery and shelf feet; one wide low shelf and one narrower tall shelf. Shelves must look intentionally empty, not like checkerboards or storage-grid UI. Individual book spines visibly occupy positions after placement.
- Character is a code-drawn warm bear with rounded stepped silhouette, dark small eyes/muzzle, scarf, limbs and directional walk cycle. At least24logicalpx tall, plus scarf accessory; no imported raster mascot.

## Palette proposal for DESIGN contract
- Ink/deep shadow: #182b2c / #263b3a.
- Timber ramp: #3a302b / #695044 / #a57954 / #d2a66e.
- Stone/plaster ramp: #394b48 / #627168 / #99a58c / #c9c8a2.
- Rug/green ramp: #1f4645 / #316b61 / #57907d / #96b59c.
- Warm paper/light ramp: #9f784d / #d5b77b / #f1dca0 / #fff0c7.
- Books/scarf add restrained dusty coral, blue and sage using darker/lighter companions. All primitive colors come from named tokens, no new random per-object palette.
- Floor texture seeded by tile coordinate, not Math.random perframe. Mostly quiet floor values so shelf contents and player remain readable. No background detail that is higher-resolution than foreground.

## Interaction appearance
- Context keycap + short verb near current object, anchored and clamped to scene viewport. Unavailable objects do not display irrelevant buttons. Close-range highlights draw corners/outline, not only hue change.
- Holding book changes actual sprite and compact inventory symbol. A short placement settle ends at exact saved slot; reduced-motion shows same final spine instantly.
- No bottom direction pad covering furniture. If pointer movement buttons are retained, give a small reserved edge region, not giant arcade arrows across play space. Keyboard-accessible scene hotspots are real focus targets.
- One semantic form modal with same paper/timber colors, clear Korean field labels, strong focus and bounded overflow; no page-like multi-column admin layout.

## Non-negotiable acceptance
Game and objects read as one authored scene. Reject flat slabs, inconsistent pixel size, floating furniture, repeated huge numbers, blurred background with sharp foreground, tiny character, inaccessible slot targets, and polished backdrop over unfinished interactions.
