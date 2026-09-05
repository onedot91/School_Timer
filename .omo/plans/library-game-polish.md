# Library game polish

Full objective: apply the preceding game-quality feedback, retaining current2D pixel art,100 shared slots and non-realtime play. Character reference is the orange bear with green scarf and cream bulb-shaped satchel at /Users/ibyeonghyeon/.codex/attachments/6ca07633-976f-46d4-a5ea-a8d68ec7dc9e/image-1.png; reinterpret as original pixel sprites, do not paste/trace raster.

- [x] 1. Capture1280×800 baseline and improve unified top-down depth/readability: quieter floor, furniture top/side/light/shadows, original directional bear carrying/walking/sitting sprites. Verified in qa.json and 52 real-browser states.
- [x] 2. Implement confirmed-only receive/place feedback, gentle optional sound, accessible reduced-motion/mute, functional reading nook, board note feedback. Preserve failures/carry, modalfocus, no dpad, rug separation and existing callbacks. Verified in qa.json and failure-qa.json (null result, retry, unavailable audio).
- [x] 3. Verify real keyboard flow, directional animation sequences, occlusion, sitting/standing, placement success/failure/reduced motion and all existing28 regression states. Final 52-state flow +3failure +3route captures passed; 580tests/lint/build/diffcheck passed. Fresh polish_composited_integrity and polish_composited_visual both PASS on current13hashes. Cleanup complete; final-audit.md records full objective and corrected occlusion.

No new dependency, engine conversion, asset generation, migration, commit or production writes. Root owns Game/world/CSS/QA; bounded renderer/art work may run independently. Skills author-game-levels, animation-systems, visual-qa. Actual1280×800 required, isolatedmock browser. Register server/browser cleanup when spawned.

Latest addition: accept English E, Hangul ㄷ and physical KeyE, including IME Process events, but show only E in the hint. Form typing is unaffected. hint-red.log proves the prior visible E · ㄷ mismatch; routes-green.log and fresh final captures verify the correction.

User additions: replace blurred canvas cue typography with native-resolution readable Gothic DOM text; all library entry hashes must open the room, not auto-open the failure board. routes.mjs reproduced the failing library entry (modalcount1 rather than0) before fixing AuctionPage's initial open flag. Server3044 session80540 is task-owned; close on completion. Character reference reinterpretation explicitly is not pixel-perfect image cloning.
