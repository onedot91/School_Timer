# Canvas Library task 1: scoped design contract

Date: 2026-09-05 (Asia/Seoul)

## Scope and change receipt

- Owned source change: appended exactly one new section, `## 9. Canvas Library Scoped Exception`, to `DESIGN.md` (63 added lines, 0 removed lines).
- No existing `DESIGN.md` paragraph was edited. No game source, route, type declaration, asset, dependency, server, or browser process was created by this task.
- The section fixes the future common contract only: fixed 1280×800 stage budget; 624×376 logical grid; named ramps; material/light/contact-shadow rules; single interleaved y-sort pass; bear walk/carry form; shelf variants; HUD/input/modal/reduced-motion semantics; and world/renderer/game ownership.
- The shared future draw interface was synchronized with the current plan: `LibraryTarget`, `LibraryScene`, and `createLibraryRenderer(canvas:HTMLCanvasElement,room:LibraryRoom):{draw:(scene:LibraryScene)=>void;dispose:()=>void}`. This is documentation, not a source declaration.

## Verification matrix

| ID | Success criterion and scenario | Exact invocation / inspection | Binary observable | Captured artifact | Verdict |
| --- | --- | --- | --- | --- | --- |
| C-01 | Document-only scope: Canvas Library is an append-only exception; global theme remains untouched. | `git diff -- DESIGN.md` and `git diff --numstat -- DESIGN.md` | One hunk appended after the final existing section; `63 0 DESIGN.md`. | This report; current `DESIGN.md` diff. | PASS |
| C-02 | Required contract primitives, states, tokens, accessibility rules, and ownership names are present. | `node --input-type=module -e "import fs from 'node:fs'; const text=fs.readFileSync('DESIGN.md','utf8'); const required=['## 9. Canvas Library Scoped Exception','native Canvas 2D only','no generated/imported images','new dependency','1256×776','1248×752','624×376','1 logical px','library-ink','library-timber','library-stone','library-green','library-paper','contact shadow','one shared, stable y-sorted depth pass','24 logical px','student-specific scarf','carrying','wide low shelf','narrow tall shelf','44×44','reserved lower-edge','in-range interaction','Arrow keys or WASD','interact only with the nearby target','pointerdown','aria-modal','Arrow keys rove','Tab and Shift+Tab','Escape closes','prefers-reduced-motion','window blur','focus return','LibraryPoint','LibraryRect','LibraryShelf','LibrarySlot','LibraryRoom','LibraryPlayer','LibraryBookDraft','LibraryPlacedBook','LibraryTarget','LibraryScene','createSmallLibraryRoom','createLibraryPlayer','stepLibraryPlayer','getNearbyLibraryTarget','placeLibraryDraft','createLibraryRenderer(canvas:HTMLCanvasElement,room:LibraryRoom):{draw:(scene:LibraryScene)=>void;dispose:()=>void}','World operations are pure','No TypeScript declarations or runtime source']; const missing=required.filter((term)=>!text.includes(term)); if(missing.length){console.error('CONTRACT_CHECK FAIL '+missing.join(' | ')); process.exit(1);} console.log('CONTRACT_CHECK PASS '+required.length+' required primitives/states/tokens/ownership phrases present');"` | `CONTRACT_CHECK PASS 51 required primitives/states/tokens/ownership phrases present`. | This report. | PASS |
| C-03 | Markdown/diff safety. | `git diff --check` | Empty output and exit code 0. | This report. | PASS |
| C-04 | Manual-QA baseline: prior bookshelf form/stack is still the old DOM surface, shows no Canvas game, and the new document has no theme drift. | Read-only `git diff -- DESIGN.md`; visual inspection of `baseline.png` at original resolution; image identity checked with `file .omo/evidence/canvas-library/baseline.png` and `shasum -a 256 .omo/evidence/canvas-library/baseline.png`. Independent owner reran `node .omo/evidence/canvas-library/baseline-qa.mjs` after this contract check. | PNG is `1280 × 800`; visually shows the pre-existing header, left book form, one book stack, and no Canvas room. SHA-256 is `7919d82d549792d4451d6de189eb7cc74b149f20ea760cad5794a521cc85f843`. Independent fresh baseline result: synthetic books `1→2`, cancel remains `1`, page `0` blocked, Canvas count `0`, port `3020` free after cleanup. | [baseline.png](./baseline.png), [baseline.json](./baseline.json), [task-1-baseline.md](./task-1-baseline.md), this report. | PASS / expected RED for absent new game |

## Manual-QA judgement

PASS. The appended section is scoped to the future library route and does not alter existing global design text. It assigns shared grid, four-step material ramp, upper-left light, floor-plane/contact-shadow, and one-pass y-sort constraints to every named future scene primitive. The inspected baseline is intentionally the former bookshelf surface, so no future art/rendering is claimed as observed. The absent Canvas game is the required RED baseline, not a skipped runtime check.

## Adversarial and cleanup record

- Dirty worktree: preserved. The pre-existing `.omo` changes and the deleted legacy draft were not reverted or edited by this task.
- Image prohibition: retained explicitly in the contract; no image generation or external/downloaded asset was used.
- Unsupported measurements: none claimed. The only visual measurement used is the independently captured `1280×800` baseline PNG; future game layout/render measurements remain later-task work.
- Not applicable to this document-only change: input parsing, runtime rendering, network/persistence, production writes, and browser interaction implementation. Their adversarial validation is assigned to later implementation tasks.
- Servers/browsers: this task started none. The independent baseline runner's owned Vite/browser resources are recorded as closed in its evidence.

## Addendum: verified small-room material synchronization (2026-09-05)

- Scope: edited only `DESIGN.md` §9 and this addendum. The token required-use table now assigns the warm timber ramp to the plank floor, the green ramp to the teal rear wall/wainscot, and stone to restrained architectural accents. The floor rule now requires staggered warm timber planks with coordinate-seeded grain and names the teal wall as the agreed boundary.
- Carry state: the bear's held book remains the Canvas-visible carry state. A single semantic DOM carry HUD/indicator may remain; a second Canvas inventory/carry badge is prohibited because it overlaps/repeats the same state.
- Manual-QA scenario: inspected [root-empty.png](./root-empty.png) and [root-carry.png](./root-carry.png) at original resolution with `view_image`. Binary observable: both frames show the warm brown staggered-plank floor below a teal rear wall/wainscot; the carry frame shows a book in the bear sprite and exactly one compact top HUD indicator, with no second Canvas inventory badge. Verdict: PASS.
- Static verification invocation: `git diff --check` and `git diff -- DESIGN.md .omo/evidence/canvas-library/task-1-contract.md`. Required binary observable: empty diff-check output/exit 0, and only §9 plus this task-1 evidence addendum changed by this sync. Result recorded after this addendum is applied.
- No browser/server/resource was created or left running by this documentation-only synchronization. Runtime, parsing, network, and persistence validations remain not applicable.
