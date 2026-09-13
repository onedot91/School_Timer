# Recipient picker — visual fidelity review

**Review type:** Read-only visual QA pass B

**Target:** `http://localhost:3000/#student-mailbox`, `편지 쓰기`, 1280×650 CSS viewport, recipient picker closed and open.

## Evidence inspected

- Fresh live DOM, rendered geometry, and screenshots for closed/open picker states on 2026-09-13.
- Baseline image: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-217fb0bf-a07a-4124-bbff-73de5b29fb1e.png`.
- [StudentMailboxPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMailboxPage.tsx:159) recipient-option source, [StudentMailboxPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMailboxPage.tsx:436) live picker component tree, and [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:644) visual styles.
- Current scoped diff for `StudentMailboxPage.tsx` and `index.css`.

## Measured live result

- Viewport/document: 1280×650px; `scrollHeight=650`, `scrollWidth=1280` (no document scroll or horizontal overflow).
- Compose card: 632.7×512px, x=525.1, y=105.0, bottom=617.0.
- Closed recipient trigger: 536.3×59.3px, x=594.1, y=154.9.
- Open list: 536.3×72.1px, x=594.1, y=223.0. It is fully within the compose-card horizontal bounds (525.1–1157.8) and viewport.
- Option: 521.5×57.3px; selected state is visible through green text, pale green fill, and a check icon. Korean text is fully rendered.
- Current mock data exposes one recipient. Source bounds the real option collection to teacher plus at most one `오늘의 친구`, so the list has at most two 3.25rem options.
- Title/input and textarea use the shared `--student-letter-body-size` token; live textarea placeholder text computed at 24.32px (`Noto Serif KR`) and textarea height is 177px. Actions remain visible.

## Findings

### CRITICAL

None. The replacement is live DOM (`button`, `div[role=listbox]`, and `button[role=option]`) rather than a screenshot, raster asset, CSS `background-image`, or a native select popup. [StudentMailboxPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMailboxPage.tsx:442)

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Conclusion

The native blue popup defect is absent: the source contains no compose `<select>` and the live expanded state is a styled in-page `role=listbox`. The trigger/list dimensions, tokenized letter type scale, selection treatment, and containment match the target visual intent without clipping or displacement.

**Recommendation: APPROVE**

**Blockers: none.**
