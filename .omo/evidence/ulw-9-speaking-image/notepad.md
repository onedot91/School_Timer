# ULW Notepad - 9번 speaking image trigger

Tier: LIGHT - existing UI logic one-condition bugfix inside TimerPage.
Skills:
- ulw-loop: user requested ulw; evidence-bound workflow.
- programming: modifies TSX.
- debugging: runtime/behavior condition was wrong.
- frontend/visual-qa: user-facing character visual behavior; browser tool unavailable, use build/bundle evidence.

Success criteria:
1. 9번처럼 speechImageSrc만 있는 캐릭터도 speaking event 후보가 된다.
2. 기존 speech 텍스트 캐릭터의 말풍선 조건은 유지된다.

RED evidence:
- command: node static guard check against src/pages/TimerPage.tsx
- result: exit 1, hasOldGuard=true, hasSpeechImageAwareGuard=false

Manual QA scenario:
- auxiliary surface: build bundle parsed with rg
- invocation: npm run build && rg student-9-heart dist/assets
- PASS observable: built JS contains student-9-heart with speechImageSrc and TimerPage guard uses character.speech||character.speechImageSrc.

Cleanup:
- no server/browser/tmux spawned for RED.

GREEN evidence:
- command: same Node static guard check after edit
- result: exit 0, hasOldGuard=false, hasSpeechImageAwareGuard=true

Verification:
- `npm run lint`: pass (`tsc --noEmit`)
- `npm run build`: pass (`vite build`)
- bundle evidence: `dist/assets/index-Dr3eMydM.js`
  - hasStudent9=true
  - hasSpeechImage=true
  - hasSpeechImageAwareGuard=true

Self-review:
- Change is limited to the `shouldSpeak` eligibility guard.
- Existing text speech characters still pass because `character.speech` remains part of the condition.
- 9번 image-only character now passes eligibility because `character.speechImageSrc` is included.

Cleanup receipt:
- no tmux/browser/temp files spawned for QA.
- previous dev server session on port 3001 was stopped; `lsof -iTCP:3001 -sTCP:LISTEN -nP` returned empty.
