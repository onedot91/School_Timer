# Failure relay transition product gate

- recommendation: APPROVE (requested shorthand: PASS)
- originalIntent: 실패 릴레이의 다음 댓글 전환을 페이드가 아닌 실제 공간 이동으로 보여 주고, 새 카드가 잘린 상단 경계에서 펼쳐지며 기존 행을 아래로 밀어내도록 한다.
- desiredOutcome: 1280×800@100%의 450ms 중간 프레임에서 불투명한 새 카드가 상단 경계에서 확장·슬라이드하고 기존 행이 함께 재배치되며, 카드 중첩·잔상·blur가 없다. 1024/1280/1366에서 수평 overflow와 toolbar/stamp 충돌이 없고 모든 행이 온전하다.

## User outcome review

요청한 물리 이동이 실제 캡처와 소스에서 확인된다. `02-moving-450ms-1280.png`는 새 고양이 카드가 릴레이의 `overflow: clip` 상단 경계에서 일부만 드러난 상태이며 아래의 강아지·너구리·판다 행이 rest 위치보다 아래로 이동해 있다. 카드들은 완전 불투명하고 선명하며 서로 겹치거나 이중상으로 보이지 않는다. rest→moving→settled 순서에서도 새 행의 삽입과 기존 행 밀림이 일관된다. 1024 캡처는 하단 행이 viewport 아래로 이어지지만 수평 잘림이나 컨트롤 충돌은 없다.

## Success criteria

| Criterion | Result | Evidence |
|---|---|---|
| FR-TRANSITION-1: next comments physically move, not fade | PASS | `StudentFailureRelay.tsx`: height `0→auto` plus `y ±100%→0`; no opacity variant |
| FR-TRANSITION-2: 450ms frame shows top-boundary expansion/slide and row push | PASS | `02-moving-450ms-1280.png` |
| FR-TRANSITION-3: no opacity/blur/ghosting/card overlap | PASS | all three 1280 frames; supplied computed `opacity=1`, `filter=none` |
| FR-RESPONSIVE-1: 1024/1280/1366 overflow and collision safety | PASS | `04-rest-1024.png`, `01-rest-1280.png`, `05-rest-1366.png`; supplied `overflowX=false`, `clippedRows=0`, `toolbarStampOverlap=0` at all three widths |

## Blockers

None.

## Direct remove-ai-slops / programming pass

- The transition is real React/Motion layout behavior, not a screenshot or hardcoded visual fake.
- The implementation uses the existing Motion dependency and two directly necessary animation layers; no unnecessary extraction, parser, normalization, dependency, opacity/filter effect, dead path, or speculative abstraction was introduced for this transition.
- No transition-specific automated test is present, but the requested product criterion is directly evidenced by the supplied timed runtime capture and computed styles. This is an evidence note, not a violated success criterion.
- `.omo/evidence/failure-relay-integrity-final-gate-review.md` explicitly records its own `remove-ai-slops / programming` pass. This direct pass independently confirms the transition-specific claims.

## Checked artifact paths

- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/failure-relay-gate2-xT0gff/01-rest-1280.png`
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/failure-relay-gate2-xT0gff/02-moving-450ms-1280.png`
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/failure-relay-gate2-xT0gff/03-settled-1280.png`
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/failure-relay-gate2-xT0gff/04-rest-1024.png`
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/failure-relay-gate2-xT0gff/05-rest-1366.png`
- `src/components/student/StudentFailureRelay.tsx`
- `src/index.css` relay/window/item rules
- `.omo/evidence/failure-relay-integrity-final-gate-review.md`

## Exact evidence gaps

- The supplied runtime metrics are present in the review brief rather than a standalone JSON/text artifact in the capture directory.
- No dedicated transition-only automated regression test artifact was supplied. Neither gap violates a stated success criterion because the timed capture, three-state sequence, source implementation, and supplied runtime measurements directly establish the requested outcome.
