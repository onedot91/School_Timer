# Shared student task header — gate review

- recommendation: REJECT
- confidence: high
- reviewType: design-system and functional integrity

## Original intent

Improve the oversized, loosely grouped student header shown by the user so `#student-store` and `#student-missions` share a compact, consistent header with a recognizable profile, clear student-number / available / reserved hierarchy, and no clipping or overflow.

## Desired outcome

- One shared header treatment on both routes.
- A true `1280×800` viewport at `100%` preview scale with a 72px header.
- A 48×48 profile with breathing room inside the header.
- Readable student number, available balance, and compact reserved balance.
- No clipping or horizontal overflow at 1024, 1280, or 1366 widths.
- Existing read-only balance presentation remains functionally intact.

## User outcome review

The implementation is structurally sound and visually coherent in the supplied secondary captures. Both pages render the same `StudentBalanceSummary` through `StudentHeader`; the route-specific CSS uses a combined `:is(.student-store-view, .student-missions-view)` selector, and the 48px profile plus 6.5rem reserved-width values come from documented tokens. The profile has visible inset space, available balance remains dominant, and the reserved value is no longer needlessly wide. No clipping or horizontal overflow is visible in the supplied captures.

Approval is nevertheless blocked because the required primary visual QA was not performed at `1280×800` with the host preview scale at `100%`. All six captures were produced at 84% and have raster widths of 1075, 860, and 1147 pixels. Per the repository's explicit Chromebook QA rule, these can only be secondary evidence and cannot establish exact-size visual verification.

## Blockers

1. **violatedCriterion:** `PRIMARY-VISUAL-1280-100`
   - observation: The required exact `1280×800 @ 100%` primary visual verification is missing; the supplied `1280` captures are 1075×672 because the host preview was 84%.
   - evidencePointer: `/private/tmp/school-header-qa/student-store-1280.jpg`, `/private/tmp/school-header-qa/student-missions-1280.jpg`, and the `AGENTS.md` viewport rule.
   - exactGap: Re-capture both routes with the browser device toolbar showing exactly `1280 × 800` and `100%`, then confirm the 72px header, 48×48 profile containment, text visibility, and absence of horizontal overflow.

## Findings

- `[product]` No blocking implementation defect found in the reviewed header scope.
- `[product]` Both routes reuse the same real DOM component and the same scoped CSS rules; there is no screenshot-only or duplicated fake header.
- `[product]` Design tokens are declared in `src/index.css` and documented in `DESIGN.md`: `--student-header-profile-size: 3rem` and `--student-header-reserved-width: 6.5rem`.
- `[product]` The identity wrapper retains a single accessible label (`N번 학생`); the decorative profile has empty alt text and the visible number is hidden from duplicate announcement.
- `[product]` The component change only adds profile presentation. Balance formatting/loading logic and route callbacks remain unchanged.
- `[evidence]` DOM metrics reported for requested host settings are useful, but the repository rule expressly disallows substituting an 84% host preview for exact 100% primary visual QA.
- `[evidence]` Secondary captures at nominal 1024/1280/1366 show consistent hierarchy, readable text, profile containment, and no visible horizontal overflow on both routes.
- `[evidence]` `npm run lint` and `npm run build` were reproduced successfully. Vite emitted only the existing large-chunk warning.

## Direct programming / remove-ai-slops pass

- No new type escape hatch, assertion, suppression, dependency, exception swallowing, or public API break appears in `StudentBalanceSummary.tsx`.
- The shared selector and shared component fix the common seam rather than duplicating route-specific implementations.
- No deletion-only, tautological, implementation-mirroring, or removal-verification tests were added in this scope.
- No needless extraction or normalization was introduced. `getFailureProfileImage` reuses the existing profile resolver.
- `balance` remains an unused pre-existing prop; it is outside this header change and is a non-blocking maintenance note.
- No code-review report explicitly covering the same skill perspectives was supplied; direct inspection supports the product implementation, but does not cure the exact-scale evidence gap.

## Checked artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBalanceSummary.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStorePage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css` (header rules around 16261–16335 and desktop rules around 20557–20580)
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/private/tmp/school-header-qa/student-store-1280.jpg`
- `/private/tmp/school-header-qa/student-missions-1280.jpg`
- `/private/tmp/school-header-qa/student-store-1024.jpg`
- `/private/tmp/school-header-qa/student-missions-1024.jpg`
- `/private/tmp/school-header-qa/student-store-1366.jpg`
- `/private/tmp/school-header-qa/student-missions-1366.jpg`

## Evidence gaps

- Missing exact-scale primary captures for both routes at `1280×800 @ 100%`.
- No supplied code-review artifact that explicitly records the programming and remove-ai-slops criteria.
- No supplied notepad path or dedicated manual-QA matrix artifact; the prompt's metric summary and six captures were inspected directly.

