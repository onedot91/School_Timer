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
| `--student-balance-compact-height` | `4rem` | compact overview balance summary |
| `--student-emotion-summary-size` | `clamp(8.5rem, 12vw, 10rem)` | enlarged overview emotion artwork control, paired with a prominent summary label and name for faster scanning |
| `--student-emotion-art-width` / `--student-emotion-art-height` | `6.5rem` / `6rem` | large picker emotion artwork frame |
| `--student-emotion-art-compact-width` / `--student-emotion-art-compact-height` | `3.25rem` / `3rem` | summary and calendar artwork frame |
| `--student-emotion-art-mobile-width` / `--student-emotion-art-mobile-height` | `5.25rem` / `4.75rem` | legacy compact fallback artwork frame; not a student-mode design target |
| `--student-emotion-calendar-max-width` | `68rem` | monthly emotion history surface width |
| `--student-emotion-calendar-cell-min-height` | `5.5rem` | calendar day target height |

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
- Student walkers keep one constant horizontal speed across the full route; path height variation and footstep bobbing run on nested layers so they cannot alter forward velocity.
- When student walkers overlap, the walker whose feet are lower on screen renders in front; depth follows the same linear timeline as the vertical path.

## 5. Components and Interaction Classes

### Controls

- Minimum target size is 44 CSS px in both dimensions.
- Keyboard focus uses a two-layer high-contrast ring with offset; it is never removed without an equivalent.
- Disabled state remains visually distinct and does not animate on press.
- Mutually exclusive settings tabs use a filled accent selected state with white label and icon; unselected tabs remain quiet and neutral.
- The schedule pane header shows only the adjusted current date on the left and the settings action on the right; month/day is larger and stronger while the weekday is smaller and secondary, and no redundant schedule title is added.
- Student mode uses page-like views for `overview`, `emotions`, `missions`, `store`, `mailbox`, and `library`. The overview is the default hub and contains one 16:9 home canvas with keyboard-accessible mailbox and library hotspots, one compact grouped identity-and-balance summary, one dedicated daily-emotion card, and exactly two dominant destination cards: `고마 벌기` for missions and `고마 쓰기` for the economy plaza. Every student starts with the damaged wooden house centered on the home canvas; the one-time `집 고치기` shop item costs 100 고마 and swaps only that student's house to the repaired artwork. An unread letter swaps the home artwork to its alert variant until the letter is opened. The student number appears at the leading edge of the balance summary and never overlays the artwork. Mission details never appear in the store, and store details never appear in the overview.
- Mail and reading records stay in one compact `studentLife` field inside the existing shared settings snapshot. The mailbox keeps received letters and supports student-to-student or teacher-to-student composition; opening an unread letter records its read time. The library records a title and page count and renders the student's latest books as a visual stack. Each book spine uses the same `1쪽 = 0.005cm` paper estimate and one shared pixels-per-centimetre scale, so twice as many pages produces twice the visible thickness; the stack top shows the summed approximate height in centimetres for the books currently rendered. These views reuse the existing Supabase updater and localStorage fallback without another table, dependency, or polling loop.
- `StudentHeader` on task pages contains the overview return action and the current page title. The store header additionally places one compact `StudentBalanceSummary` at the trailing edge so spendable and bid-reserved amounts remain visible without a separate body card; narrower screens wrap that grouped balance to a second header row. Student identity and character are not repeated outside the overview. `StudentBalanceSummary` presents available and reserved 고마 as one grouped unit instead of competing cards; the reservation state remains visible at `0 고마` so a student can distinguish spendable and bid-reserved amounts immediately.
- Student missions use two explicit groups: the built-in `감정 구슬 넣기` task and teacher-configured items appear under `일일 미션`, and synced rewards appear under `주간 미션`. The emotion task opens the internal picker, gives `5 고마` only on the first saved emotion for that Korean local date, and presents completion after the reward is recorded. Each mission card exposes status, reward, and an action. The mission page may show one progress/reward summary, while the overview stays free of detailed mission metrics. Only verified existing service destinations may become links; missions without a destination contract show a disabled classroom action instead of an invented URL.
- `StudentEmotionSummary` is a dedicated overview card with the small `오늘의 감정` label, the current emotion name, and one enlarged artwork control. The text is anchored near the card top and the artwork occupies the lower visual field so the card stays immediately scannable without redundant copy. It never repeats the 36-option catalog on the overview. `StudentEmotionPage` is the sole picker surface. It uses the supplied four-zone artwork vocabulary: red, yellow, blue, and green zones, each with nine image-backed radio-style `StudentEmotionOrb` controls in the exact 3×3 order of the reference. Every viewport uses four zone tabs and reveals one 3×3 image grid at a time, so the selection and short comment remain visible without any overlay.
- The `내 기록` section of `StudentEmotionPage` uses a familiar seven-column monthly calendar: weekday headers form one quiet band, date numbers stay at the top-left, today receives a compact text badge, and empty dates carry no decorative status dot. A recorded date pairs its emotion orb and visible emotion label with a restrained zone-colored cell surface, date color, and selected ring so the month can be scanned by color without relying on color alone. The adjacent sidebar separates the selected date detail from a compact monthly zone summary showing red, yellow, blue, and green counts and proportions. Month navigation changes both the calendar and summary without changing the stored history.
- Emotion selection is a deliberate two-step action: choosing an orb updates a local draft, and one sticky confirmation control records it. The selected orb receives an inset ring and check indicator; press feedback follows the project radio-pattern mechanism with `scale(.98)`, while reduced motion keeps the same color and ring state without transform animation.
- Daily emotion data is stored per student and Korean local date in the shared `studentEmotionHistory` settings field. Its first daily save also appends a deterministic `daily_emotion` entry to the existing currency history, which keeps the 5고마 payment idempotent across Supabase retries and the localStorage fallback. One entry is kept per student per date, and a later save updates that date without deleting older days or paying again.
- A short reason is required and limited to 80 characters. The student emotion page separates `오늘 고르기` from `내 기록`; the teacher `감정 현황` utility pane shows today's class status and a selected student's chronological emotion/comment history.
- External mission actions open a new tab with `noopener noreferrer`, identify themselves as external links in visible and accessible copy, and keep the current mission page available when the student returns.
- The student auction is a Chromebook-only operational surface. Its main auction area gives the current unlocked weekday dominant scale, keeps the item list and bid controls in one desktop workspace, and presents every other weekday as compact secondary navigation. The selected item uses an accent fill, inset edge, and pressed state rather than a detached duplicate summary.
- When no auction day is open, the item area shows one consolidated locked state instead of repeating an identical locked card for every private item. The overview return action uses the primary green treatment so it remains unmistakable in sparse task headers.
- The store begins with one supplied 16:9 plaza illustration. Bank, shop, auction, securities, and donation are keyboard-focusable hotspots aligned to the depicted buildings and bottom-right lot. Existing labels drawn into the scene are not repeated as detached copy; hover and focus use one clear outline. The donation hotspot shows one of three supplied speech-bubble character cutouts selected from the Korean local date, remains stable for that day, and renders no detached label below it.
- Bank, shop, securities, auction, and donation render as separate store subpages. Bank supports compact deposit, savings, and loan transactions; the shop lists fixed-price items; securities shows deterministic daily classroom prices with one-share buy/sell controls; the existing auction workspace remains functionally unchanged; donation retains its confirmation modal. All spend paths validate auction-reserved currency before changing the existing shared balance.
- Store economy state is kept as a compact `studentEconomy` object inside the existing shared settings value and local snapshot. Transaction request IDs make Supabase updater retries idempotent without a new table, migration, dependency, or polling path.
- The student shop is a Chromebook-first three-part destination: `물품`, `캐릭터 뽑기`, and `집`. Teacher-authored fixed-price goods and per-student purchase counts share the existing settings JSON. Character draws cost 100 고마 and immediately become the active home-canvas character. The house workshop stays locked until `집 고치기`; market houses cost 100 고마 and a custom design coupon costs 150 고마. Avoid mobile-only rearrangements for this surface; validate at 1024, 1280, and 1366px widths.
- Student page navigation uses `#student-overview`, `#student-emotions`, `#student-missions`, `#student-store`, and `#student-store-*` hashes. Hash changes create normal browser history entries, reload restores the selected view, and no routing dependency is introduced.
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
- Student-mode pages must remain usable without horizontal overflow at the required Chromebook widths and at 200% text zoom. Fluid sizing may absorb normal Chromebook window variation, but it must not compromise the desktop information hierarchy to optimize for phone widths.
- Layout uses `min-height: 100dvh` where viewport height is required.
- At 200% text zoom, controls wrap or scroll within their own task surface; the page never gains horizontal overflow.
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
