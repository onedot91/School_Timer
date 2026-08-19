# School Timer Apple Interface Contract

## 0. Direction

School Timer is a light-only classroom operations interface. It borrows Apple's calm hierarchy, system typography, physical press response, restrained material depth, and adaptive accessibility behavior while retaining the app's warm cream, green, paper, and character identity.

The product is operational rather than promotional. The timer, current schedule, auction state, and active task remain visually dominant. Decoration never competes with live classroom information, and the redesign adds no visible explanatory copy.

Reference set:

- Project `apple-design` guidance: immediate response, interruptibility, symmetric paths, material hierarchy, adaptive motion and transparency.
- Apple web reference: neutral canvases, restrained depth, system typography, precise control geometry.
- Existing School Timer screens and character assets: warm green identity and familiar classroom affordances are preserved.

## 1. Principles

1. Response starts on pointer-down. Enabled controls visibly compress without waiting for click completion.
2. Information hierarchy precedes decoration. Timer and current task always win the first glance.
3. Materials communicate interaction class. Blocking work uses a scrim and one translucent outer material; parallel tools do not use a scrim.
4. Glass never stacks. Cards inside translucent shells are opaque or tonal.
5. Motion follows the source and returns along the same path. Interactive motion remains interruptible and reversible.
6. Existing workflows, storage contracts, and character assets are immutable. The overview reserves a character stage but keeps it empty until a student character is created. Visible copy may change only when an approved feature specification requires a clearer task hierarchy.
7. Accessibility preferences produce complete alternatives, not degraded remnants.

## 2. Semantic Tokens

### Color

| Token | Value | Role |
| --- | --- | --- |
| `--apple-canvas` | `#f5f5f7` | application background |
| `--apple-canvas-warm` | `#f7f4ee` | warm classroom background |
| `--apple-surface` | `#ffffff` | solid content surface |
| `--apple-surface-muted` | `#f2f2f4` | grouped controls and quiet regions |
| `--apple-material-regular` | `rgba(255,255,255,.78)` | compact floating chrome |
| `--apple-material-thick` | `rgba(255,255,255,.9)` | modal and large-sheet material |
| `--apple-text-primary` | `#1d1d1f` | primary text |
| `--apple-text-secondary` | `#5f5f65` | secondary text |
| `--apple-text-tertiary` | `#77777d` | tertiary text with accessible contrast |
| `--apple-accent` | `#007a57` | School Timer primary action and selection |
| `--apple-accent-pressed` | `#006b4d` | pressed primary action |
| `--apple-separator` | `rgba(60,60,67,.2)` | quiet boundary |
| `--apple-separator-strong` | `rgba(60,60,67,.34)` | control boundary |
| `--apple-focus` | `#0066cc` | keyboard focus signal |
| `--apple-scrim` | `rgba(24,24,27,.34)` | blocking-layer background |
| `--emotion-red` / `--emotion-red-soft` | `#b6453f` / `#f9e4df` | tense and activated emotion zone |
| `--emotion-yellow` / `--emotion-yellow-soft` | `#c18a12` / `#fff3c4` | energized and pleasant emotion zone |
| `--emotion-blue` / `--emotion-blue-soft` | `#3e6eb3` / `#e5edf9` | low-energy and difficult emotion zone |
| `--emotion-green` / `--emotion-green-soft` | `#4f8a4f` / `#e6f1df` | calm and settled emotion zone |
| `--student-stock-up` / `--student-stock-up-soft` | `#c43832` / `#fff0ed` | Korean-market rise signal: red upward triangle and quiet surface |
| `--student-stock-down` / `--student-stock-down-soft` | `#2f66b0` / `#edf4ff` | Korean-market fall signal: blue downward triangle and quiet surface |

Existing semantic success, warning, and destructive colors remain feature-owned until their surfaces are migrated. They must not be repurposed as decoration.

### Type

- Body and controls: `-apple-system`, `BlinkMacSystemFont`, `"SF Pro Text"`, `"Apple SD Gothic Neo"`, `"Noto Sans KR"`, `sans-serif`.
- Display: the same platform stack with weight and tracking, not a decorative family.
- Clock and numeric data retain the existing mono stack and use tabular figures.
- `font-optical-sizing: auto` is enabled where supported.
- Display text uses tight leading and negative tracking; body text uses neutral tracking and readable leading; small labels use slight positive tracking.

### Geometry

| Token | Value | Role |
| --- | --- | --- |
| `--apple-radius-control` | `0.75rem` | fields and compact controls |
| `--apple-radius-card` | `1.125rem` | content groups |
| `--apple-radius-panel` | `1.75rem` | large sheets and panels |
| `--apple-radius-pill` | `999px` | segmented and capsule controls |
| `--apple-control-min` | `2.75rem` | minimum interactive target |
| `--apple-page-gutter` | `clamp(0.75rem, 1vw, 1.25rem)` | desktop shell breathing room |
| `--apple-pane-gap` | `clamp(0.75rem, 1vw, 1.25rem)` | separation between primary and control panes |
| `--apple-control-pane-width` | `clamp(30rem, 29vw, 34rem)` | desktop schedule/control pane width |
| `--apple-tv-safe-inline` | `max(3.5vw, env(safe-area-inset-left), env(safe-area-inset-right))` | TV overscan-safe left and right inset |
| `--apple-tv-safe-block` | `max(3.5vh, env(safe-area-inset-top), env(safe-area-inset-bottom))` | TV overscan-safe top and bottom inset |
| `--student-character-stage-aspect-ratio` | `16 / 9` | full-bleed character and background artwork canvas in the overview |
| `--student-home-house-width` / `--student-home-house-height` | `48%` / `88%` | shared centered home-artwork frame, larger than the bookstore while preserving ground alignment |
| `--student-home-mailbox-hotspot-*` | `54% 8% 14% 32%` (`top left width height`) | tight mailbox action target with a small visual-edge allowance |
| `--student-home-egg-hotspot-*` | `16% 7% 12.5% 14%` (`top left width height`) | tight nest-and-egg action target excluding the surrounding branches |
| `--student-home-library-hotspot-*` | `42% 3% 27% 38%` (`top right width height`) | tight bookstore action target excluding excess sky and foreground |
| `--student-home-emotion-sun-top` / `--student-home-emotion-sun-right` | `3%` / `2.5%` | selected daily emotion position in the open upper-right sky, separated from the large cloud like the reference sun |
| `--student-home-emotion-sun-size` | `clamp(5.5rem, 11vw, 8rem)` | sun-like daily emotion artwork size inside the overview canvas |
| `--student-balance-compact-height` | `4.5rem` | shared overview and task-header balance height |
| `--student-overview-balance-width` | `clamp(22rem, 30vw, 24rem)` compact; `clamp(23.5rem, 31vw, 25rem)` desktop | centered balance column width; desktop gives the always-visible reserved amount enough room without competing with destination cards |
| `--student-overview-content-width` | `72rem` | shared maximum width for the 16:9 overview canvas and its three-column destination dock |
| `--student-emotion-summary-size` | `clamp(8.5rem, 12vw, 10rem)` | enlarged overview emotion artwork control, paired with a prominent summary label and name for faster scanning |
| `--student-emotion-art-width` / `--student-emotion-art-height` | `6.5rem` / `6rem` | large picker emotion artwork frame |
| `--student-emotion-art-compact-width` / `--student-emotion-art-compact-height` | `3.25rem` / `3rem` | summary and calendar artwork frame |
| `--student-emotion-art-mobile-width` / `--student-emotion-art-mobile-height` | `5.25rem` / `4.75rem` | legacy compact fallback artwork frame; not a student-mode design target |
| emotion mood-meter layout | `2 × 2` zones, each `3 × 3` emotions | show all 36 emotions together at the 1280×800 Chromebook viewport; do not hide zones behind tabs |
| `--student-emotion-calendar-max-width` | `68rem` | monthly emotion history surface width |
| `--student-emotion-calendar-cell-min-height` | `5.5rem` | calendar day target height |
| `--student-chromebook-width` / `--student-chromebook-height` | `1280px` / `800px` | primary student-device design viewport |
| `--student-shell-inset` | `0.75rem` | compact outer inset at the Chromebook viewport |
| `--student-shell-gap` | `0.75rem` | shared gap between student shell regions |
| `--student-header-height` | `4.5rem` | one-row task header including title, back action, and optional balance |
| `--student-overview-action-height` | `7rem` | paired overview destination cards at the Chromebook viewport |
| `--student-overview-header-padding-block` | `0.4rem` | vertical inset for the compact balance header |
| `--student-overview-card-padding` | `0.75rem 1rem` | compact overview destination-card inset |
| `--student-overview-card-title-size` | `1.45rem` | overview destination-card title size |
| `--student-content-height` | `calc(100dvh - 6rem)` | task content budget after outer inset, header, and shared gap |
| `--student-card-radius` | `1.25rem` | student task cards and grouped panels |
| `--student-compact-control-height` | `2.75rem` | compact Chromebook control with a 44px minimum target |
| `--student-readable-text-min` | `0.875rem` | minimum student-facing supporting text at the 1280×800 reference viewport |
| `--student-readable-image-min` | `3rem` | minimum meaningful thumbnail or status artwork at the reference viewport |
| `--student-letter-sender-size` | `clamp(1.35rem, 1.8vw, 1.6rem)` | sender label inside the student letter paper |
| `--student-letter-title-size` | `clamp(2.5rem, 3.5vw, 3.125rem)` | primary title inside the student letter paper |
| `--student-letter-body-size` | `clamp(1.75rem, 2.45vw, 2.125rem)` | readable serif body copy inside the student letter paper |
| `--student-investment-card-title-size` | `1.2rem` | investment stock name and primary card heading |
| `--student-investment-reason-size` | `clamp(1.1875rem, 1.7vw, 1.375rem)` | prominent serif stock-change reason text that remains readable across Chromebook widths |
| `--student-investment-amount-size` | `1.55rem` | prominent invested/current Goma amount |
| `--student-investment-result-size` | `2rem` | most prominent gained or lost Goma result |
| `--student-investment-control-height` | `3.25rem` | amount input and paired investment actions in the roomier two-row trade panel |
| `--student-sudoku-cell-size` | 도전 `clamp(3.6rem, min(8.4vh, 6vw), 4.25rem)`; 기본 `clamp(4.75rem, min(10vh, 8vw), 6rem)` | difficulty-aware square cell: 9×9 challenge stays fully operable while 6×6 basic uses the reclaimed area for larger third-grade-friendly targets |
| `--student-sudoku-selected` | `color-mix(in srgb, var(--apple-accent) 14%, var(--apple-surface))` | selected cell and matching row/column/box context |
| `--student-sudoku-matching` | `color-mix(in srgb, var(--apple-accent) 30%, var(--apple-surface))` | every cell containing the selected nonzero digit; darker than peer context |
| `--student-sudoku-conflict` | `#b6453f` | duplicate digit and incorrect completed-board signal |
| `--student-motion-press` | `120ms` | pointer/touch press feedback; keyboard-triggered actions stay instant |
| `--student-motion-state` | `180ms` | selection, save-state, modal, and mission-state feedback |
| `--student-motion-celebrate` | `720ms` | one-shot Sudoku completion wave and light-particle sequence |
| `--student-ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | responsive state entry and press release |
| `--student-ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | short on-surface continuity transitions |
| `--teacher-investment-label-size` | `0.75rem` | compact teacher-only investment setting labels |

The spacing base is `0.25rem`. New spacing uses multiples of that base and scales with text when it affects reflow.

### Depth

| Token | Role |
| --- | --- |
| `--apple-shadow-1` | subtle raised control |
| `--apple-shadow-2` | floating utility panel |
| `--apple-shadow-3` | blocking sheet or dialog |

One surface uses one elevation signal. Avoid combining thick borders, large shadows, and glass on the same element.

## 3. Materials

- Regular material: compact floating toolbars and anchored utility panes; soft saturation and 20px blur.
- Thick material: modal and large sheet; higher opacity, 28px blur, quiet edge highlight, and deeper shadow.
- Child content: solid `--apple-surface` or tonal `--apple-surface-muted`.
- Material arrival: a single outer layer synchronizes opacity, scale, and blur. Descendants do not independently materialize.
- Reduced transparency: replace both materials with opaque surfaces and remove backdrop filters.
- Increased contrast: use near-solid surfaces and a defined strong separator.

## 4. Interaction and Motion

- Enabled buttons, links styled as controls, and interactive `[role="button"]` elements respond on `:active` with `scale(.98)` and restrained opacity.
- Interactive transitions list explicit compositor-safe properties. `transition: all` is prohibited.
- The default response curve is critically damped in character: quick response, no ornamental bounce.
- An interaction may retarget while moving. It begins from the current presentation value and never locks input to finish a transition.
- Timed draw and award sequences may keep choreography, but safe cancellation boundaries and reduced-motion equivalents are required.
- Reduced motion removes large translation, rotation, looping decoration, and elastic overshoot while retaining short opacity or color feedback.
- Student interaction motion follows the beui.dev `button`, `otp-input`, `animated-badge`, and centered-modal mechanisms: pointer/touch presses use a quick interruptible scale response, entered digits use a short scale-and-opacity settle, status labels crossfade in place, and the difficulty dialog scales from `0.96` at the viewport center. Keyboard number entry and arrow navigation never run transform motion; their color, border, and text state updates are immediate.
- Sudoku conflicts use one restrained border/color pulse with at most 3px lateral displacement for pointer/touch input. The same keyboard or reduced-motion path uses only the conflict surface and inset border. Completion is the only celebratory sequence: one green board wave plus eight small light particles, finishing within `--student-motion-celebrate`, never blocking input or replaying when a completed puzzle is reopened.
- Mission cards reveal once when the mission view becomes active with a 35ms stagger and no delayed interactivity. Difficulty modal entry/exit and action presses correspond to real navigation or selection changes; student pages never add looping decorative motion.
- Student walkers keep one constant horizontal speed across the full route; path height variation and footstep bobbing run on nested layers so they cannot alter forward velocity.
- When student walkers overlap, the walker whose feet are lower on screen renders in front; depth follows the same linear timeline as the vertical path.

## 5. Components and Interaction Classes

### Controls

- Minimum target size is 44 CSS px in both dimensions.
- Keyboard focus uses a two-layer high-contrast ring with offset; it is never removed without an equivalent.
- Disabled state remains visually distinct and does not animate on press.
- Mutually exclusive settings tabs use a filled accent selected state with white label and icon; unselected tabs remain quiet and neutral.
- The schedule pane header shows only the adjusted current date on the left and the settings action on the right; month/day is larger and stronger while the weekday is smaller and secondary, and no redundant schedule title is added.
- Student mode uses page-like views for `overview`, `emotions`, `missions`, `store`, `mailbox`, and `library`. The overview is the default hub and contains one 16:9 home canvas with keyboard-accessible mailbox and library hotspots, then one compact grouped identity-and-balance summary centered between exactly two dominant destination cards: `고마 벌기` for missions and `고마 쓰기` for the economy plaza. The overview has no separate top header so the canvas receives the reclaimed vertical space, and no balance content overlays the canvas artwork. Every student starts with the damaged wooden house centered on the home canvas; the one-time `집 고치기` shop item costs 100 고마 and swaps only that student's house to the repaired artwork. An unread letter swaps the home artwork to its alert variant until the letter is opened. The student number remains at the leading edge of the centered balance summary. Mission details never appear in the store, and store details never appear in the overview.
- Mail and reading records stay in one compact `studentLife` field inside the existing shared settings snapshot. The mailbox keeps received letters and supports student-to-student or teacher-to-student composition; opening an unread letter records its read time. The library records a title and page count and renders the student's latest books as a visual stack. Each book spine uses the same `1쪽 = 0.005cm` paper estimate and one shared pixels-per-centimetre scale, so twice as many pages produces twice the visible thickness; the stack top shows the summed approximate height in centimetres for the books currently rendered. These views reuse the existing Supabase updater and localStorage fallback without another table, dependency, or polling loop.
- `StudentHeader` on task pages contains the overview return action and the current page title. The overview intentionally omits this top header and places its compact `StudentBalanceSummary` in the center column between the two bottom destination cards. The store header additionally places one compact `StudentBalanceSummary` at the trailing edge so spendable and bid-reserved amounts remain visible without a separate body card; narrower screens wrap that grouped balance to a second header row. A balance nested inside a task header keeps the same two-line label/value hierarchy but removes its own outer border and shadow to avoid a card inside a card. Student identity and character are not repeated outside the overview. `StudentBalanceSummary` presents available and reserved 고마 as one grouped unit instead of competing cards; the reservation state remains visible at `0 고마` so a student can distinguish spendable and bid-reserved amounts immediately.
- The student securities flow uses third-grade language and one question per screen. `내 투자` shows only owned-stock count, total result, total sell value, and the owned-stock list; invested cost and other duplicate summaries are omitted. When nothing is owned, one compact empty state and one `종목 고르기` action replace the summary and empty list. `종목 고르기` shows all four stocks in one `4×1` row at the 1280×800 Chromebook viewport, with ownership, one red-up/blue-down result, a market comment only when one is registered, one price, and separate `사기` and `팔기` actions. The unavailable action remains visible but disabled so the two directions never move or change meaning. Buying or selling always opens a short confirmation dialog and uses `개`, `사기`, `팔기`, and `고마` instead of specialist trading terms.
- Teacher securities settings place the frequently edited weekly market first: all four stocks and Monday through Friday appear in one matrix and save as one weekly batch, while the selected day's short reasons remain directly below it. Long-lived minimum, maximum, and rounding rules stay at the bottom. Keep the weekly draft keyed by date and stock so a later paste or text-file importer can feed the same save path.
- Student missions use two explicit groups: the built-in `감정 구슬 넣기` task and teacher-configured items appear under `일일 미션`, and synced rewards appear under `주간 미션`. The emotion task opens the internal picker, gives `5 고마` only on the first saved emotion for that Korean local date, and presents completion after the reward is recorded. Each mission card exposes a bordered status chip, prominent reward pill, title/short next-step copy, and one full-width action. Sudoku distinguishes `진행 전`, `진행 중`, and `완료` before the action label is read. The mission page may show one progress/reward summary, while the overview stays free of detailed mission metrics. Only verified existing service destinations may become links; missions without a destination contract show a disabled classroom action instead of an invented URL.
- The built-in `스도쿠` daily mission displays both possible rewards, `+5 고마` and `+15 고마`, in the mission-card reward position. Its action opens a focused settings dialog only when there is no unfinished or completed puzzle to revisit for the current Korean date. The dialog presents two complete-card actions with the same anatomy: board-size chip, difficulty name and age-appropriate rule summary, prominent reward, then a filled `이 난이도로 시작` direction row. The hierarchy makes the 6×6/9×9 difference scannable before the reward without adding a separate confirmation step. Students select `기본` or `도전` before entering `StudentSudokuPage`, and that choice is saved immediately; returning before completion opens the same difficulty directly through `이어 풀기`, and returning after completion opens the preserved solved board through `다시 보기`. Difficulty cannot change while a puzzle is unfinished, and revisiting never overwrites completed progress. `기본` is a third-grade-friendly 6×6 board using digits 1–6 and 2×3 blocks with a 1–6 keypad. `도전` is the former basic assignment: the same deterministic 9×9 generation profile with 40 given cells, digits 1–9, and 3×3 blocks. The changed puzzle schema uses a new deterministic puzzle ID so a legacy 9×9 save cannot be loaded into the new 6×6 board or the reassigned challenge solution. The play header displays the chosen difficulty, reward, and explicit saving/saved/error state without another settings control. Keeping difficulty controls out of the play surface lets each board use the largest square cells that still keep its keypad visible at Chromebook widths. The board and keypad form one intrinsic-width workspace that is centered as a visible group inside the task panel; an expanding invisible keypad track must never bias the composition toward either side. Full keyboard input remains available, limited to the digits in the active board. When all instances of a digit are on the board, that digit disappears from the keypad without shifting the remaining key positions and the matching physical number key becomes inactive until one instance is erased. Given cells use the muted grouped-control material and inset edge; student-entered digits use the accent color, stronger weight, and a distinct paper surface. Selected peers use `--student-sudoku-selected`. When a nonzero cell is selected, every occurrence of that digit uses the darker `--student-sudoku-matching` fill, while selecting an empty cell adds no digit match highlight. Row, column, and active block duplicates use the semantic conflict surface plus an inset error border and accessible invalid state. The current Korean date, student number, and difficulty deterministically select a uniquely solvable puzzle. Progress is automatically saved inside the existing shared-settings value with localStorage fallback. Completion awards exactly `5 고마` for 기본 or `15 고마` for 도전 through the existing currency ledger, using one deterministic transaction ID per assigned puzzle so retries, refreshes, and repeated completion cannot pay twice.
- `StudentEmotionSummary` is a dedicated overview card with the small `오늘의 감정` label, the current emotion name, and one enlarged artwork control. The text is anchored near the card top and the artwork occupies the lower visual field so the card stays immediately scannable without redundant copy. It never repeats the 36-option catalog on the overview. `StudentEmotionPage` is the sole picker surface. It uses the supplied four-zone artwork vocabulary: red, yellow, blue, and green zones, each with nine image-backed radio-style `StudentEmotionOrb` controls in the exact 3×3 order of the reference. At the 1280×800 Chromebook viewport, all four zones form a 2×2 mood meter so all 36 emotions can be compared without switching tabs. Each zone shows only its short color title above the grid, without an explanatory sentence; choosing an emotion opens the short-comment confirmation dialog without changing the grid.
- The `내 기록` section of `StudentEmotionPage` uses a familiar seven-column monthly calendar: weekday headers form one quiet band, date numbers stay at the top-left, today receives a compact text badge, and empty dates carry no decorative status dot. At 1280×800, its six possible calendar weeks divide the remaining task height evenly so the full month, selected-day detail, and monthly zone summary remain visible without vertical scrolling. A recorded date pairs its emotion orb and visible emotion label with a restrained zone-colored cell surface, date color, and selected ring so the month can be scanned by color without relying on color alone. The adjacent sidebar separates the selected date detail from a compact monthly zone summary showing red, yellow, blue, and green counts and proportions. Month navigation changes both the calendar and summary without changing the stored history.
- Emotion selection is a deliberate two-step action: choosing an orb updates a local draft, and one sticky confirmation control records it. The selected orb receives an inset ring and check indicator; press feedback follows the project radio-pattern mechanism with `scale(.98)`, while reduced motion keeps the same color and ring state without transform animation.
- Daily emotion data is stored per student and Korean local date in the shared `studentEmotionHistory` settings field. Its first daily save also appends a deterministic `daily_emotion` entry to the existing currency history, which keeps the 5고마 payment idempotent across Supabase retries and the localStorage fallback. One entry is kept per student per date, and a later save updates that date without deleting older days or paying again.
- A short reason is required and limited to 80 characters. The student emotion page separates `오늘 고르기` from `내 기록`; the teacher `감정 현황` utility pane shows today's class status and a selected student's chronological emotion/comment history.
- External mission actions open a new tab with `noopener noreferrer`, identify themselves as external links in visible and accessible copy, and keep the current mission page available when the student returns.
- The student auction is a Chromebook-only operational surface. Its main auction area gives the current unlocked weekday dominant scale, keeps the item list and bid controls in one desktop workspace, and presents every other weekday as compact secondary navigation. The selected item uses an accent fill, inset edge, and pressed state rather than a detached duplicate summary. Auction item cards omit generic placeholder artwork and prioritize a clear name, bidder, and labeled current price. Items always occupy the upper full-width section in six stable positions arranged as a `3×2` grid; assigned items fill those positions in order and unassigned positions remain visibly empty. The selected item's bid/purchase controls occupy a separate full-width section immediately below, and together both sections use the available Chromebook task height without a detached blank lower region.
- When no auction day is open, the item area shows one consolidated locked state instead of repeating an identical locked card for every private item. The overview return action uses the primary green treatment so it remains unmistakable in sparse task headers.
- The store begins with one supplied 16:9 plaza illustration. Bank, shop, auction, securities, and donation are keyboard-focusable hotspots aligned to the depicted buildings and bottom-right lot. Existing labels drawn into the scene are not repeated as detached copy; hover and focus use one clear outline. The donation hotspot shows one of three supplied speech-bubble character cutouts selected from the Korean local date, remains stable for that day, and renders no detached label below it.
- Bank, shop, securities, auction, and donation render as separate store subpages. Bank deposit, loan, and transfer amounts accept any positive whole number of 고마 while preserving their existing maximum limits; the shop lists fixed-price items; securities shows deterministic daily classroom prices with one-share buy/sell controls; the existing auction workspace remains functionally unchanged; donation retains its confirmation modal. All spend paths validate auction-reserved currency before changing the existing shared balance.
- Store economy state is kept as a compact `studentEconomy` object inside the existing shared settings value and local snapshot. Transaction request IDs make Supabase updater retries idempotent without a new table, migration, dependency, or polling path.
- The student shop is a Chromebook-first three-part destination: `물품`, `캐릭터 뽑기`, and `집`. Teacher-authored fixed-price goods and per-student purchase counts share the existing settings JSON. Character draws cost 100 고마 and immediately become the active home-canvas character. The house workshop stays locked until `집 고치기`; market houses cost 100 고마 and a custom design coupon costs 150 고마. Avoid mobile-only rearrangements for this surface; validate at 1024, 1280, and 1366px widths.
- Student page navigation uses `#student-overview`, `#student-emotions`, `#student-missions`, `#student-sudoku`, `#student-store`, and `#student-store-*` hashes. `#student-store-securities` is the single securities screen; the legacy `#student-store-securities-trade` hash resolves to the same screen for existing links. Hash changes create normal browser history entries, reload restores the selected view, and no routing dependency is introduced.
- The student shell is designed first at exactly `1280×800` with a `16:10` aspect ratio, matching the classroom Chromebook. It uses a 12px outer inset, a single 72px task header, and a content region that owns any necessary vertical scrolling. The document itself does not scroll during normal task use.
- At the reference viewport, student-facing supporting text never renders below `14px` (`0.875rem`), interactive labels target `16px` or larger, and meaningful thumbnails or status artwork remain at least `48×48px`. In operational auction surfaces, weekday labels, supporting bid information, and price labels target at least `15px`, while item names, prices, inputs, and primary actions use clearly larger type. Primary character, pet, house, emotion, and prize artwork receives substantially more space than this minimum. Tiny type is reserved for non-student admin metadata only.
- Density reductions must come from removing duplicated copy, shortening labels, and grouping related controls, not by shrinking text or meaningful artwork. If content cannot fit, its designated content region scrolls while the header and primary action remain stable.
- Each task page has one visible page title. Store subpages do not repeat `은행`, `상점`, `증권사`, `경매장`, or `기부` inside the body after the title already appears in `StudentHeader`.
- 초등 3학년용 증권사는 한 화면에 세 섹션을 순서대로 둔다: `내 투자` 현황, 종목별 오늘의 등락과 이유, 하나의 `투자하기 · 투자금 찾기` 조작 패널. 조작 패널은 종목 선택 1개, 금액 입력 1개, 투자·회수 버튼 각 1개만 제공해 네 종목마다 같은 버튼을 반복하지 않는다. 학생은 주가·주식 수·퍼센트 없이 보유 고마 중 원하는 정수 금액을 종목에 넣고, `투자한 돈 → 오늘의 결과 → 늘거나 줄어든 고마 → 현재 금액`만 확인한다. 결과는 빨간 `▲▲ 많이 올랐어요`·`▲ 올랐어요`, 중립 `─ 그대로예요`, 파란 `▼ 내렸어요`·`▼▼ 많이 내렸어요`의 다섯 단계로 표현하며 색상만으로 구분하지 않는다. 변화한 고마를 가장 크게 표시하고 내부 배율·등락률·수익률은 학생 화면에 절대 노출하지 않는다. 월요일부터 금요일까지만 날짜별 결과를 한 번 적용하고 토·일은 `휴장`으로 표시한다. 오늘 투자한 금액에는 오늘 결과를 소급 적용하지 않는다. 교사 설정은 운영 규칙과 날짜별 결과를 분리하고, 날짜·종목마다 `-50%`부터 `+50%`까지 10% 단위로 선택한다. 학생 문구는 `-50~-30%` 많이 내렸어요, `-20~-10%` 내렸어요, `0%` 그대로예요, `+10~+20%` 올랐어요, `+30~+50%` 많이 올랐어요로 자동 변환한다. 퍼센트는 교사 설정에만 노출하며 내부 배율로 변환해 정산한다. 관리자는 날짜별 네 종목의 퍼센트와 짧은 이유, 정수 반올림 방식, 최소·최대 투자 금액을 설정하며 학생별 현재 투자금과 누적 증감을 확인한다.
- 증권 종목 카드는 직접 선택하는 단일 버튼이다. 누른 카드는 초록 테두리·inset ring으로 유지되며, 거래 패널은 같은 선택을 읽는다. 카드의 press feedback은 `scale(.98)`이고, 키보드 초점은 `--apple-focus` ring으로 구분한다. 별도의 종목 드롭다운은 두지 않는다.
- 종목 카드는 짧은 등락 pill을 두고, 카드 하단에는 그날의 이유를 명조 계열의 큰 일반 굵기 글자로 생략 없이 모두 보여준다. 이유 영역은 상승·하락 색상의 세로선으로 상태와 연결하되 색상만으로 의미를 전달하지 않는다. 보유한 종목은 `내 투자` 라벨과 금액을 분리한 배지로, 보유하지 않은 종목은 같은 위치의 회색 `투자 없음` 배지로 표시하며 문장 부호로 상태를 연결하지 않는다. 큰 등락 상태 블록과 반복된 선택 안내는 사용하지 않는다.
- 고마 스킨은 후보를 미리 보여주지 않는 인형 뽑기 기계로 제공한다. 상단 탭이 현재 상점 종류를 설명하므로 기계 안에는 별도 표제를 반복하지 않는다. 크림색 캐비닛 안에서 왼쪽은 깊이감 있는 유리 진열장과 서로 겹친 익명 캡슐 더미, 레일의 2지형 집게를 담고, 오른쪽은 구매와 실제 조작을 담당하는 전용 패널로 고정한다. 집게는 넓은 판이 아니라 중앙 모터 하우징의 힌지에서 시작하는 가느다란 금속 관 두 개로 표현한다. 두 팔은 바깥으로 벌어진 뒤 하단에서 서로를 향해 안쪽으로 말리고 어두운 고무 패드로 끝나며, 닫힘 연출에서는 두 패드가 가까워져 캡슐을 집는 방향을 분명히 한다. 캡슐은 제공된 핑크·레드·그린·퍼플·피치·오렌지·블루·브라운·그레이 일러스트를 쓰며, 원본의 초록 배경은 색상 키 필터로 투명 처리해 유리 진열장 색과 섞이지 않게 한다. 진열장에는 한국 시간 날짜에 따라 매일 달라지는 다섯 개의 큰 캡슐만 보이며, 같은 날에는 새로고침해도 같은 배치를 유지한다. 구매 확인 후에는 좌우 버튼이나 방향키로 집게를 다섯 위치 사이에서 움직이고 `집게 내리기`를 눌러야 재화 차감과 뽑기가 시작된다. 집게는 선택한 캡슐과 같은 X축에서 움직이고, 레일 연결점은 고정된 채 케이블이 늘어나 목표 높이에 닿는다. 양쪽 턱이 캡슐을 감싸며 닫히는 순간 바닥 캡슐이 집게로 인계되고, 들어 올린 뒤에는 작은 관성 흔들림과 정착 동작만 보인다. 이 약 2.3초 연출이 끝난 뒤에만 실제 스킨 이미지와 이름을 공개한다. 사용 가능한 고마는 페이지 상단 잔액만 표시한다. 애니메이션은 `transform`·`opacity`만 사용하고, 모션 감소 환경에서는 이동·점멸을 생략한 채 캡슐 인계와 결과 공개 순서만 짧은 opacity 전환으로 표시한다.
- 보유 스킨 목록은 상점에 반복하지 않는다. 학생 홈 캔버스의 고마 캐릭터를 빠르게 두 번 누르면 스킨 선택 창이 열리고, 보유 스킨과 항상 함께 보이는 `기본 고마` 중 하나를 고르면 즉시 홈 캐릭터에 적용한다. 캐릭터 드래그는 이동으로 유지하며, 키보드는 캐릭터에 초점을 둔 뒤 Enter 또는 Space로 같은 선택 창을 연다.
- Student headers keep the back action, title, and balance on one row at 1280px. The balance is a compact grouped status with `사용 가능` dominant and `예약` secondary; neither value is repeated in body content.
- Content density follows a three-level hierarchy: page title and primary action, current state and selection, then supporting history or detail. Decorative descriptions and counts are removed when their meaning is already conveyed by grouping, label, or disabled state.
- Every student task identifies one primary action. Secondary actions remain visible but use quieter surfaces. Disabled actions state why through the adjacent status label or accessible name instead of additional explanatory paragraphs.
- The overview destination cards mirror around the centered balance: `고마 벌기` places a decorative left arrow at the outer-left edge and its title/icon toward the center, while `고마 쓰기` places its title/icon toward the center and a decorative right arrow at the outer-right edge. Each complete card is one semantic button and one continuous touch/focus target; it never nests a smaller action button. The full destination dock uses the same maximum width as the 16:9 home canvas. Reserved currency is a compact secondary status badge inside the centered balance, not a competing card.
- The overview fits its home canvas, balance, emotion, pet state, and both destinations within the first 800px viewport. Mailbox and library remain direct hotspots, while `고마 벌기` and `고마 쓰기` remain the only dominant destination cards.
- Mission groups, store catalogs, and emotion history may scroll inside their own content region. Their page header and section controls remain visible, and no nested panel creates horizontal scrolling.
- Empty states use one icon, one short status sentence, and at most one action. Repeated headings, instructional subtitles, and decorative counters are omitted when they do not change the next decision.
- Student shared-state syncing is egress-aware: the last successful normalized settings payload is cached locally, then the client checks only `app_settings.updated_at` before fetching the full settings value. In conservative free-plan mode, overview checks at most every five minutes while visible and the active store checks at most every 30 seconds. Missions/emotions refresh on entry, save, or foreground return; foreground events are coalesced for 30 seconds. Hidden tabs do not poll; concurrent refreshes are ignored so one student view never overlaps full settings requests.
- Body copy and form content remain selectable. Decorative images may remain non-selectable.

### True modals

- Exactly one active top layer owns `aria-modal`, initial focus, Tab containment, safe Escape dismissal, background isolation, and trigger focus return.
- Nested dialogs isolate the parent's inactive content without making the active child inert.
- Escape closes only the top safe layer and is disabled only during an in-flight destructive or asynchronous commit.
- Status announcements do not steal focus.

### Full-screen task overlays

- Announcement and memo tasks own a modal-like focus scope.
- A non-modal child drawer closes before its parent and returns focus to its trigger.

### Utility panes

- YouTube, library, question status, currency, and emotion status remain parallel anchored panes.
- They expose expanded state, do not trap focus, and do not inert the main task.

## 6. Responsive Behavior

- Admin and timer surfaces retain their existing broad responsive coverage, including low-height landscape displays.
- All student-mode pages are Chromebook-first. Their required design and visual-QA widths are 1024, 1280, and 1366 CSS px; phone-specific proportions, mobile-only compositions, and touch-first rearrangements are outside scope unless explicitly requested.
- `1280×800` (`16:10`) is the authoritative student layout. At this viewport the shell itself remains fixed to `100dvh`; only the designated task-content region may scroll, and the primary action for the current task must be visible without document scrolling.
- At 1024px the same information hierarchy is preserved with denser columns or one internal content scroll. At 1366px additional width increases breathing room but never enlarges the header or pushes actions below the 800px height budget.
- Between phone and full Chromebook widths, the overview keeps its three-part destination dock in one row: mission, grouped balance, and store. Destination actions reduce only their internal spacing; they never grow into a second row that can be clipped by the fixed student shell.
- Student-mode pages must remain usable without horizontal overflow at the required Chromebook widths and at 200% text zoom. Fluid sizing may absorb normal Chromebook window variation, but it must not compromise the desktop information hierarchy to optimize for phone widths.
- Layout uses `min-height: 100dvh` where viewport height is required.
- At 200% text zoom, controls wrap or scroll within their own task surface; the page never gains horizontal overflow. The Sudoku workspace switches from its normal board-and-keypad columns to one stacked column, and the board cells fit the available content width.
- Student emotion zone grids use three equal columns with 44px minimum targets. One active zone catalog is visible at a time, while all four zone selectors remain reachable without horizontal scrolling at Chromebook widths.
- Korean copy is not rewritten to fit. Containers reflow around the exact existing text.
- Fixed toolbars and overlays respect safe-area insets.
- Desktop timer content stays inside a 3.5% TV-safe frame. Student walkers may travel from the timer pane across the schedule pane as a pointer-transparent foreground layer and always render above the face, clock, status, and schedule pane.
- Low-height 16:9 displays reduce walker size without shrinking the clock, status control, or schedule type below their responsive scales.

## 7. Accessibility Constraints

- `:focus-visible` remains clearly distinguishable at a minimum 3:1 adjacent contrast.
- `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more`, and `forced-colors: active` each have an explicit system response.
- Forced colors preserve control boundaries, selection, focus, and disabled states using system colors.
- Dialog names come from existing visible headings or non-rendered accessible attributes; no new visible copy is introduced.
- Emotion zones use the active labelled zone group on student Chromebook screens. Arrow keys move and select among visible orbs; tab controls use roving focus and connected tab panels. Every orb exposes its Korean emotion label and selected state without relying on color alone; zone descriptions and icons reinforce but never replace text.
- Text selection is enabled globally except for controls and decorative media.

## 8. Accepted Debt and Handoff

- `src/index.css` and `TimerPage.tsx` are oversized legacy files. This redesign uses one final scoped Apple theme layer and a narrow focus behavior hook rather than a broad rewrite.
- Existing feature-specific raw colors and motion remain until their owning surface migration task. New Apple rules live only in the ordered final theme subsections.
- Standalone `RandomDrawPage` remains outside normal routing and is verified through an evidence-only entry.
- No React tooling or UI dependency is added by this redesign.
- Shared settings currently use anonymous class-wide read access and do not provide student identity. Student UI filters emotion history to its selected entry number, but database-level confidentiality for comments requires a later authenticated student/teacher model and a dedicated RLS-protected table; the requested shared `app_settings` field does not provide that boundary.
- The short-term shared `app_settings` snapshot remains compatible with current classroom data. Before classroom-wide scale beyond this egress policy, high-churn collections such as bid history, emotion history, pet state, and currency history should move to dedicated, student-scoped tables so each screen reads only the data it needs.
- Every implementation wave must preserve the fixed visible-text oracle and use isolated fixtures; live classroom balances, bids, awards, history, and Supabase data are never QA inputs.
