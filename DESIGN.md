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
6. Existing rendered strings, workflows, storage contracts, and character assets are immutable.
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

## 5. Components and Interaction Classes

### Controls

- Minimum target size is 44 CSS px in both dimensions.
- Keyboard focus uses a two-layer high-contrast ring with offset; it is never removed without an equivalent.
- Disabled state remains visually distinct and does not animate on press.
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

- YouTube, library, question status, and currency remain parallel anchored panes.
- They expose expanded state, do not trap focus, and do not inert the main task.

## 6. Responsive Behavior

- Required widths: 320, 390, 768, 1024, 1280, and 1440 CSS px, including low-height landscape displays.
- Layout uses `min-height: 100dvh` where viewport height is required.
- At 200% text zoom, controls wrap or scroll within their own task surface; the page never gains horizontal overflow.
- Korean copy is not rewritten to fit. Containers reflow around the exact existing text.
- Fixed toolbars and overlays respect safe-area insets.

## 7. Accessibility Constraints

- `:focus-visible` remains clearly distinguishable at a minimum 3:1 adjacent contrast.
- `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more`, and `forced-colors: active` each have an explicit system response.
- Forced colors preserve control boundaries, selection, focus, and disabled states using system colors.
- Dialog names come from existing visible headings or non-rendered accessible attributes; no new visible copy is introduced.
- Text selection is enabled globally except for controls and decorative media.

## 8. Accepted Debt and Handoff

- `src/index.css` and `TimerPage.tsx` are oversized legacy files. This redesign uses one final scoped Apple theme layer and a narrow focus behavior hook rather than a broad rewrite.
- Existing feature-specific raw colors and motion remain until their owning surface migration task. New Apple rules live only in the ordered final theme subsections.
- Standalone `RandomDrawPage` remains outside normal routing and is verified through an evidence-only entry.
- No React tooling or UI dependency is added by this redesign.
- Every implementation wave must preserve the fixed visible-text oracle and use isolated fixtures; live classroom balances, bids, awards, history, and Supabase data are never QA inputs.
