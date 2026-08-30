# Profile continuity — fresh functional regate

- recommendation: APPROVE
- blockers: []
- originalIntent: 가챠 애니메이션에서 잠긴 카드와 실제 저장된 프로필 결과가 별도 카드처럼 교체되지 않고 하나의 연속된 결과로 이어져야 한다.
- desiredOutcome: `shuffling → revealing → result` 전 구간에서 동일 winning frame/front DOM을 유지하고, 결과 카드 위치가 움직이지 않으며, 저장 영수증의 프로필만 공개한다. 일반/동작 줄이기 모두 정확한 `1280×800`에서 접근성·처리 잠금·직접 구매 동작을 보존한다.
- userOutcomeReview: PASS. 현재 구현과 제공된 최신 런타임 관찰은 이전의 56px 결과 점프 및 shuffle/reveal 별도 DOM 결함이 해소되었음을 일치해서 보여 준다.

## Criterion review

| criterion | result | evidence |
|---|---|---|
| C1_PERSISTENT_WINNER | PASS | `src/components/student/StudentProfileGachaDialog.tsx:117-119,280-291,377-428`: arcade 단계가 같은 key/subtree를 사용하며 `.student-profile-gacha-winning-frame`과 `.student-profile-gacha-flip-front`가 shuffling부터 result까지 조건부 재마운트 없이 존재한다. 제공 런타임 `continuityProbe:'same-node'`가 result까지 생존한다. |
| C2_ONLY_REEL_GATE_EXIT | PASS | `StudentProfileGachaDialog.tsx:338-376`: reel track과 selection gate만 `stage === 'shuffling'` 조건이며 winning frame은 그 밖에 있다. 제공 result 관찰은 `reelCards: 0`. |
| C3_RESERVED_GEOMETRY | PASS | `StudentProfileGachaDialog.tsx:431-458`, `src/index.css:23409-23419`: copy는 `min-height:7rem`, label은 `visibility`, action은 항상 DOM에 존재하고 숨김 상태에서 `visibility:hidden`이므로 결과 전환 때 최종 행 공간을 새로 삽입하지 않는다. 제공 최신 정상 타임라인에서 종전 56px 점프가 재현되지 않는다. |
| C4_AUTHORITATIVE_RECEIPT | PASS | `StudentProfileGachaDialog.tsx:121,426,433-440`: front image의 유일한 결과 입력은 `receipt.profileImage`; result는 동일 front DOM을 유지한다. `src/lib/studentProfilePurchase.ts:102-113,145-154`는 실제 선택·저장된 `profileImage`와 price를 반환한다. 제공 런타임 reveal/result 모두 `/failure-profiles/thumbs/20-hamster.png`. |
| C5_DECOY_EXCLUSION | PASS | `StudentProfileGachaDialog.tsx:62-76,122-126`: deck 후보는 `profile.imageSrc !== resultImage`; `studentShopPresentation.test.ts`는 결과 제외, 원본 후보 소속, 12장, 결정성을 관찰 가능한 계약으로 검증한다. |
| C6_RUNTIME_1280 | PASS | 제공 최신 정상 관찰: saving 238ms, shuffling 637ms, revealing 2509ms, result 2961ms, viewport/document `1280×800`, focus `확인`, result reelCards 0. reduced 관찰: result `1280×800`, winner static matrix, back identity/no rotation animation, front none, reelCards 0, focus `확인`. |
| C7_LOCKS_ARIA | PASS | `StudentProfileGachaDialog.tsx:113-119,133-163,170-227,254-279`: 처리 단계 dismiss 잠금, close 미렌더, stage/ref 중복 시작 잠금, dialog semantics, live region, `aria-busy`, result focus가 유지된다. |
| C8_DIRECT_PURCHASE_UNAFFECTED | PASS | `src/lib/studentProfilePurchase.ts:19-21,60-68,102-104`와 `StudentShopPage.tsx:186-202,259-270`: selected 50고마 경로는 기존 purchase union/handler를 사용하며 random gacha dialog는 random 분기에만 적용된다. 전체 테스트 통과. |
| C9_NO_FAKE | PASS | 결과는 live React `<img src={receipt.profileImage}>`이며 screenshot/canvas/background-image/mock result substitution이 없다. |
| C10_VALIDATION | PASS | 2026-08-30 fresh rerun: `npm run lint` exit 0; `npm test` 389/389; `npm run build` exit 0, 기존 >500kB chunk warning만 존재; `git diff --check` exit 0. |

## Direct remove-ai-slops / programming pass

직접 diff·production·test pass에서 결과 대체 helper, 불필요한 parser/normalizer/extraction, dead result branch, type suppression, 새 dependency, tautological expected-value derivation, deletion-only continuity test, mock-only success는 발견하지 못했다. Deck test는 인덱스 공식을 복제하지 않고 cardinality/source membership/result exclusion/determinism이라는 외부 계약을 검증한다. Presentation test의 일부 copy/negative-markup assertion은 구현 결합과 유지보수 부담이 있으나, 연속성 성공을 뒷받침하는 핵심 근거는 source/runtime/full suite로 독립되어 있어 비차단 NOTE다. `StudentProfileGachaDialog.tsx`는 250 pure-LOC 기준을 넘는 큰 단계 renderer지만 이 작업의 명시 성공 기준 실패가 아니므로 NOTE이며, read-only regate에서 범위 밖 구조 변경을 요구하지 않는다.

기존 `.omo/evidence/profile-arcade-function-regate-gate-review.md` 및 `.omo/evidence/profile-continuity-function-gate-review.md`는 직접 slop/overfit 관점을 포함한다. 별도 code-review 파일은 발견되지 않았지만 gate 정책상 이번 직접 pass가 모든 명시 기준을 검증하므로 blocker가 아니다.

## Checked artifacts

- `src/components/student/StudentProfileGachaDialog.tsx`
- `src/index.css`
- `DESIGN.md`
- `src/lib/studentProfilePurchase.ts`
- `src/lib/studentShopPresentation.test.ts`
- `src/components/student/StudentShopPage.tsx` (직접 구매 wiring 확인용 read-only caller inspection)
- `.omo/evidence/profile-continuity-visual-gate-clone-fidelity.md` (이전 blocker 확인)
- `.omo/evidence/profile-continuity-function-gate-review.md`
- `.omo/evidence/profile-arcade-function-regate-gate-review.md`
- `tmp/visual-qa/profile-gacha/capture-arcade-cdp.mjs`
- `tmp/visual-qa/profile-gacha/capture-arcade-reduced-cdp.mjs`

## Exact evidence gaps / notes

- `omo` executable이 PATH에 없어 `omo ulw-loop status --json`를 실행할 수 없었다. 따라서 지시된 no-plan fallback 경로를 사용했다.
- 할당 입력에 명시된 최신 runtime probe의 원문 JSON/log 파일은 workspace에서 찾지 못했다. 다만 현재 동일-key React 구조, 결과 이미지 직접 binding, 최신 runtime 관찰값, fresh lint/test/build가 각 기능 기준을 독립적으로 뒷받침하므로 비차단 evidence NOTE다.
- 최신 캡처 목록은 할당 입력에 제공되었으나 이 regate 입력 자체에는 각 파일 경로가 열거되지 않았다. 현재 source와 런타임 수치가 명시 기준을 충족하므로 blocker가 아니다.

