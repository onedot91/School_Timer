# Classword topic header — clone fidelity review

**Recommendation:** APPROVE  
**Scope:** Teacher Classword topic header only; reviewed against the supplied student header crop and previous teacher-header crop.

## Evidence inspected

- `src/components/teacher/TeacherClasswordPanel.tsx` (current source and working-tree diff)
- `src/components/student/StudentClasswordPage.tsx` (shared header consumer)
- `src/classword.css` and `src/index.css` (shared rules and tokens)
- `DESIGN.md` (teacher Classword design contract)
- `tmp/visual-qa/teacher-classword-topic-header-1280x800.jpg` — valid 1280×800 JPEG, modified after the three rendered-source files
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-ae10b30a-ed18-4b54-aace-7ba174a78aaf.png` — student header reference
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-806e79f5-cab3-431b-87e7-eb9215bd1511.png` — prior teacher-header reference

The cropped references are different dimensions from the full-page actual capture, so a pixel-diff percentage would not be meaningful. Direct inspection verified the relevant header treatment.

## Findings

### CRITICAL

None. The header is a live `<section>/<header>/<h3>/<span>/<strong>` tree at `TeacherClasswordPanel.tsx:150-159`; it is not an image, canvas, or CSS background substitute.

### HIGH

None. `TeacherClasswordPanel.tsx:152` consumes the existing `classword-header-topic` primitive, which is also used by `StudentClasswordPage.tsx:220`. The lime-to-sky topic underline comes from the shared `strong::after` rule in `classword.css:22-37`, not a teacher-only imitation.

### MEDIUM

None. The visible topic is dynamic (`todayBoard.topic`) at `TeacherClasswordPanel.tsx:153-156`; the capture's `QA 친구` is therefore data, not fixed display copy. The old date, `오늘 입력 낱말`, and `n/14칸` header content is absent from the replacement header.

### LOW

None. The teacher font-size override in `classword.css:550` is driven by the documented `--teacher-classword-topic-size` token from `index.css:12620` and `DESIGN.md:180`. It preserves the shared topic treatment while fitting the administrative panel.

## Visual result

The fresh 1280×800 capture shows `오늘의 주제는 QA 친구입니다.` with the intended lime-to-sky underline beneath only `QA 친구`, no clipping or overlap, and no legacy date/title/count in the topic-header region. This matches the requested structural change and preserves the student-header design language.

## Blockers

None.
