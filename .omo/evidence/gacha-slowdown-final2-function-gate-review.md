# Gacha Slowdown Final 2 — Function Gate Review

## recommendation

APPROVE

## blockers

None.

## originalIntent

랜덤 프로필 가챠 릴의 전체 재생 시간을 늘리고, 정지 직전 속도를 단계적으로 낮춰 당첨 카드가 고정된 뒤 실제 저장 결과로 자연스럽게 공개되도록 한다.

## desiredOutcome

- 일반 모션에서 릴이 3200ms 재생된다.
- 마지막 1120ms가 점진적 감속이며 마지막 160ms는 같은 위치를 유지한다.
- 감속 후 고정된 물음표 카드가 560ms 공개 단계에서 실제 구매 영수증의 프로필로 뒤집힌다.
- 저장·셔플·공개 중 닫기와 중복 구매가 차단된다.
- reduced motion은 릴 없이 220ms 불투명도 전환으로 결과를 보여 준다.
- 저장 화면에서 릴 화면으로 넘어갈 때 빈 카드나 한글 상태 문구 중첩이 없다.

## userOutcomeReview

요청한 체감 개선이 구현되었다. `shuffleMs=3200`이며 감속 시작점이 2080ms라 마지막 1120ms를 65%→72.5%의 점점 짧아지는 이동 구간으로 사용한다. 마지막 두 transform이 같고 keyframe 시간이 0.95→1.0이므로 160ms 결과 위치 고정이 성립한다. 2660ms부터 중앙 물음표 카드가 고정되고, 셔플 종료 뒤 동일 winning-frame에서 `receipt.profileImage`가 560ms 공개 단계에 표시된다. 연속 1280×800 프레임은 저장 화면, 완전히 로드된 릴, 감속, 물음표 고정, 펭귄 flip, 펭귄 결과 화면을 순서대로 보여 주며 빈 화면·문구 중첩·잘림을 보이지 않는다.

## checkedArtifacts

- `src/components/student/StudentProfileGachaDialog.tsx` lines 37-67, 89-105, 119-251, 264-499
- `src/lib/studentShopPresentation.test.ts` timing/deck tests
- `DESIGN.md` motion tokens and gacha choreography contract
- `tmp/visual-qa/profile-gacha/slowdown-motion-final-2/01-confirm.png`
- `tmp/visual-qa/profile-gacha/slowdown-motion-final-2/frame-0000.jpg` through `frame-0094.jpg` (all 1280x800; representative frames inspected: 0000, 0010, 0030, 0050, 0060, 0068, 0072, 0076, 0080, 0084, 0088, 0094)
- Full test run reproduced: 389 passed, 0 failed
- `npm run lint` reproduced: exit 0
- `npm run build` reproduced: exit 0; only existing >500kB chunk warning
- `git diff --check` reproduced: exit 0

## criterionReview

- C1 3200ms reel: PASS — runtime token and timer both use `STUDENT_PROFILE_GACHA_MOTION.shuffleMs`.
- C2 1120ms staged slowdown: PASS — slowdown starts at 2080ms; explicit linear keyframe distances progressively shrink through the 3200ms endpoint.
- C3 160ms hold: PASS — transform remains `translate3d(-72.5%, 0, 0)` from time 0.95 to 1.0.
- C4 authoritative 560ms reveal: PASS — front face uses only `receipt.profileImage`; reveal timer is 560ms.
- C5 close/duplicate lock: PASS — processing stages are non-dismissible, close control is absent, backdrop path is guarded by `handleClose`, and `isStartingRef` prevents repeated purchase invocation.
- C6 reduced motion 220ms: PASS — shuffle duration is 0, result timer is 220ms, and reel/3D branches are skipped.
- C7 blank/overlap prevention: PASS — decoy/result images preload before `shuffling`; saving exit duration is zero and shuffling mounts opaque. Fresh continuous evidence shows loaded cards and one status surface at a time.

## directRemoveAiSlopsAndProgrammingPass

- No dead branch, debug output, broad empty catch, type suppression, speculative dependency, or unrelated production abstraction was introduced in the reviewed change.
- The duration test is narrow and contract-facing; it is not a deletion-only or prose-pinning test. The deterministic deck test checks the user-visible integrity invariant that decoys exclude the committed result.
- The component is 480 pure LOC, exceeding the skill's general size ceiling. This is recorded as a maintenance NOTE, not a blocker: the user's stated success criteria do not require a structural refactor, and a read-only gate must not expand this narrowly scoped animation change.
- No separate code-review report for this exact final-2 attempt was supplied. Direct source, diff, automated gates, and continuous visual evidence provide the required criterion coverage.

## exactEvidenceGaps

- No machine-readable capture timeline accompanies `slowdown-motion-final-2`; exact durations are therefore proven from the runtime constants/timers/keyframe fractions, while the continuous frames prove the visible transition order and absence of discontinuity.
- No automated browser assertion specifically simulates Escape/backdrop clicks during every processing substage. The shared focus hook plus `isDismissible=false` and guarded `handleClose` prove the implemented path; this does not block the stated outcome.

