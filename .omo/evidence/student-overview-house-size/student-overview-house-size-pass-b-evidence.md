# Student overview house-size — fresh visual QA pass B evidence

- Surface: student overview static PNG capture.
- Exact invocation: `view_image("/private/tmp/school-timer-overview-house-size-valid.png", detail:"original")`.
- Capture validation: `file` reports `PNG image data, 1117 x 837, 8-bit/color RGB, non-interlaced`; `sips` reports 1117×837.
- Visual observation: the repaired-house artwork is visibly larger than the smaller bookshop, sits on the overview canvas center axis, and remains inside the canvas with no clipping. House and bookshop bases meet the same illustrated ground plane; there is clear separation between the buildings. The bear/mailbox foreground is rendered intentionally in front of the house rather than producing an accidental asset collision.
- CJK observation: visible Korean labels (`1번`, `사용 가능 고마`, `예약 고마`, `오늘의 감정`, `아직 선택하지 않았어요`, `고마 벌기`, `고마 쓰기`) are rendered with intact glyphs, no tofu, baseline clipping, or detached one-character lines. `아직 선택하지 않았어요` wraps at a readable phrase boundary for this narrow card.
- Source contract: `DESIGN.md:76` defines `--student-home-house-width` / `--student-home-house-height` as `46%` / `85%`; `src/index.css:15297-15298` declares them; `src/index.css:16233-16242` consumes them in the shared frame with `left:49.5%`, `bottom:12%`, `object-fit:contain`, and `object-position:center bottom`; `src/components/student/StudentPetStage.tsx:111-116` uses the same frame for both before/after house assets.
- Oracle note: no subagent/oracle tool was exposed in this environment, so the required independent parallel oracle passes could not be run; this is an evidence-process limitation, not a product finding.
