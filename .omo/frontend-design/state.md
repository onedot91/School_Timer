# Frontend design state

## Mailbox redesign

- Direction: warm child-friendly “고마 우체국”, built from live envelope, stamp, wax-seal, and paper primitives rather than generic cards or raster mockups.
- Primary viewport: exactly 1280×800 at browser 100%; 1024 and 1366 widths are secondary checks.
- Layout: shared 72px `StudentHeader`, then a bounded 34:66 list-detail workspace. The left envelope list is the only normal scroll owner; the right paper scrolls internally only for long copy.
- State: closed envelope + wax seal + `새 편지` text for unread, open flap for read, raised depth for selected. Green bank/system, yellow teacher, pink/blue student stamps.
- Motion: 280ms transform/opacity selection transition, no bounce or decorative loop; reduced-motion removes transforms.
- Data: derive sent mail from existing `senderStudentNumber`; do not change `StudentLetter`, persistence shape, Supabase, or localStorage contracts.
- Accessibility: semantic buttons and tabs, visible focus, text labels alongside color, native Enter/Space activation, and live status for unread count.
- Avoid: giant empty paper, document scroll, generic white card grid, hidden header actions, narrow mobile-first redesign, and any live-data mutation during QA.
