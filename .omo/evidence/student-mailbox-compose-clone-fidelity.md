# Student mailbox compose — clone fidelity review

**Review type:** Visual QA pass B (visual fidelity and CJK precision), read-only review

**Target:** `http://localhost:3000/#student-mailbox`, `편지 쓰기` tab, 1280×650 CSS viewport

**Reference/intent:** Remove the redundant `새 편지 / 마음을 담아 보내요` compose heading; make the compose card and content textarea noticeably taller while preserving visible actions, unclipped Korean labels, and no document scrolling.

## Evidence inspected

- Fresh live browser capture at `http://localhost:3000/#student-mailbox` after selecting `편지 쓰기`, viewport 1280×650 (captured 2026-09-12).
- Read-only live DOM/geometry inspection: viewport 1280×650; `document.documentElement.scrollHeight = 650`, `body.scrollHeight = 650`, `scrollY = 0`.
- [StudentMailboxPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMailboxPage.tsx:377) compose render tree.
- [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:613) compose grid and textarea sizing rules.
- Current scoped diff for the two files above.

## Measured rendered result

- Compose form: x=525.1, y=105.0, 632.7×512.0px; bottom=617.0px.
- Textarea: x=594.1, y=330.7, 536.3×198.9px; approximately twice the annotated ~100px baseline.
- Actions: y=542.4, height=52.0px, bottom=594.4px. They remain fully visible with 55.6px clearance before viewport bottom.
- Korean labels `받는 사람`, `제목`, `내용`: each has a 536.3px available width, 22.5px rendered height, and no scroll/client overflow. Header tabs are 44px tall and also have no overflow.
- The form subtree contains no `새 편지` or `마음을 담아 보내요` text.

## Findings

### CRITICAL

None. The form is a live React DOM tree: `label`, `select`, `input`, `textarea`, and `button` elements are rendered in [StudentMailboxPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMailboxPage.tsx:379). No screenshot/raster/background-image replaces the interactive compose controls.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## What is correct

- [StudentMailboxPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMailboxPage.tsx:383) now starts the form with the recipient field, removing the redundant visual heading from the surface.
- [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:613) makes the compose card a four-row grid whose body row is `minmax(0, 1fr)`; [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:644) lets the live textarea consume that row. This is layout-driven rather than a fixed mock or image.
- The visual hierarchy is stable: recipient, title, content, then two 52px action controls. The long writable area dominates appropriately without covering the actions.
- No CJK split, clipped glyph, or label overflow is visible in the requested state.

## Recommendation

**APPROVE**

## Blockers

None.
