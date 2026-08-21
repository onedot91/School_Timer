# Bookshelf natural layout — final fresh visual/CJK gate

- recommendation: APPROVE
- verdict: PASS
- blockers: none

## Original Intent

이전 결과에서 책 두께가 거의 같아 보이고 좌우 배치가 부자연스러웠던 문제를 해결한다. 15/30/37/45쪽 책은 쪽수에 따라 분명히 다른 두께로 보여야 하며, 책 더미의 중심은 안정적으로 유지하되 손으로 쌓은 듯 아주 미세한 폭·중심 변화가 있어야 한다. 1024/1280/1366 CSS px에서 제목·글쓴이·쪽수 한글 표기와 책장 경계가 안전해야 한다.

## Desired Outcome

네 책의 등 높이가 27/36/40.2/45px로 명확히 구분되고, 폭은 81%–92%, 중심 이동은 -1%–1% 범위의 절제된 리듬을 사용한다. 세 목표 해상도 모두에서 스택, 선반, 높이 말풍선 및 CJK 메타데이터가 잘리거나 겹치지 않는다.

## User Outcome Review

PASS. 세 실제 캡처에서 15쪽 파랑 책이 가장 얇고, 30쪽 분홍, 37쪽 주황, 45쪽 초록 순으로 등 두께가 명확히 증가한다. 이전 캡처의 거의 동일한 두께 인상은 사라졌다. 폭은 서로 다르지만 과도한 지그재그 없이 중심축 주변에 머물며, 각 책의 좌우 끝단이 조금씩 달라 자연스러운 폭 리듬을 만든다. 1024/1280/1366 모두에서 책·선반·말풍선이 패널 안에 있고 수평 오버플로 또는 경계 잘림이 없다. `고구마구마`, `궁궁궁구`, `사이다 지음`, `고고 지음`, `15쪽/30쪽/37쪽/45쪽`이 겹침 없이 읽힌다.

## Criterion Checks

- C1 — 15/30/37/45쪽의 뚜렷한 두께 차이: PASS. `getBookSpineHeightPx(pageCount) = 18 + pageCount * 0.6`으로 각각 27/36/40.2/45px이며 세 캡처에서 육안 차이가 유지된다.
- C2 — 안정적이되 미세하게 달라지는 중심: PASS. 현재 4개 레이아웃 오프셋은 `0.5%, -1%, 0%, 0.75%`로 중심축을 보존하면서 완전 정렬만 피한다.
- C3 — 자연스러운 폭 리듬: PASS. 현재 4개 폭은 `86%, 82%, 90%, 85%`로 반복적 계단이나 과도한 좌우 돌출 없이 끝단 차이를 만든다.
- C4 — 3개 목표 폭의 clipping/overflow 안전성: PASS. 실제 1024×768, 1280×800, 1366×768 캡처에서 패널·스택·선반 경계 이탈이 보이지 않는다.
- C5 — 제목/글쓴이/쪽수 CJK: PASS. grid의 `minmax(0, 1fr) auto auto`, 제목 및 글쓴이 ellipsis 규칙으로 실제 한글 문자열이 세 폭 모두에서 충돌하지 않는다.
- C6 — programming/remove-ai-slops 직접 검토: PASS. 계산과 레이아웃은 작고 typed 된 단일 책임 helper이며 type suppression, dead code, 과도한 방어·파싱·정규화가 없다. 테스트는 삭제 여부나 구현 문구를 확인하지 않고 숫자 단조성, 대표 페이지 높이, 레이아웃 다양성·경계·주기성을 검증한다. 불필요한 extraction이나 tautological/deletion-only test는 발견하지 못했다.

## Checked Artifact Paths

- before screenshot: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-eb0761b0-59eb-46fa-b68b-75def4f8acb3.png`
- conceptual reference: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-16ba5156-3f8f-43ce-a368-8ce1332f7f16.png`
- actual: `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1024.png`
- actual: `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1280.png`
- actual: `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1366.png`
- source: `src/components/student/StudentLibraryPage.tsx`
- source: `src/lib/studentLife.ts`
- test: `src/lib/studentLife.test.ts`
- style: `src/index.css`
- token contract: `DESIGN.md`
- prior review artifacts: `.omo/evidence/bookshelf-stack-clone-fidelity.md`, `.omo/evidence/bookshelf-stack-design-final-gate-review.md`, `.omo/evidence/bookshelf-stack-pixel-final-gate-review.md`, `.omo/evidence/bookshelf_stack_fidelity_final-clone-fidelity.md`, `.omo/evidence/bookshelf_stack_fidelity_gate-clone-fidelity.md`

## Reproduced Verification

- `node --test --experimental-strip-types src/lib/studentLife.test.ts`: PASS, 8/8.
- `npm run lint` (`tsc --noEmit`): PASS.
- `git diff --check`: PASS.
- PNG signatures/dimensions: PASS for both supplied references and all three actual captures.

## Evidence Gaps / Notes

- `omo ulw-loop status --json` could not run because the `omo` executable is unavailable, so this report uses the documented `.omo/evidence/<goal>-gate-review.md` fallback.
- No dedicated current-attempt executor report, code-review report, manual-QA matrix, or notepad was supplied for this narrow fresh visual pass. This is not a blocker: no stated criterion requires those files, and the gate independently inspected the current source/diff, all requested captures, focused tests, typecheck, and overfit/slop criteria.
- The 15→30쪽 difference is strongest; 37→45쪽 is smaller but still plainly visible and mathematically proportional. No criterion requires equal visual spacing between every page-count pair.
