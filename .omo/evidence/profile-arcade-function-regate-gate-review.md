# Profile arcade function re-gate

## recommendation

APPROVE

## blockers

None.

## originalIntent

랜덤 프로필 구매가 실제 저장 영수증의 프로필을 결과로 공개하고, 저장이 성공한 뒤 12장의 결과 제외 디코이 카드로 아케이드 셔플·공개를 진행하되 처리 중 닫기와 중복 구매를 막고 실패는 재시도 가능하게 만든다. 기존 특정 프로필 50고마 구매 경로는 유지하며, 정확한 1280×800 화면에서 일반 모션 1700ms+500ms와 reduced-motion 220ms, 접근 가능한 포커스·ARIA 동작을 제공한다. 문서화된 모션 값은 런타임 상수와 검사 가능한 CSS custom properties의 단일 소스여야 한다.

## desiredOutcome

사용자는 저장 중/셔플 중/공개 중 상태를 순서대로 보고, 서버·로컬 저장이 확정한 프로필만 결과로 받는다. 처리 단계에서는 Escape·배경 클릭·반복 실행이 동작하지 않고, 오류 뒤에는 같은 확인 화면에서 다시 시도할 수 있다. 결과 화면은 릴 카드를 남기지 않고 확인 버튼에 포커스를 두며, reduced-motion에서는 릴 이동과 회전 없이 짧은 opacity 전환만 사용한다.

## userOutcomeReview

PASS. `onPurchase()`의 성공 outcome 전체를 `receipt`로 저장하고 공개/결과 이미지와 가격 안내가 모두 `receipt.profileImage` 및 `receipt.price`를 사용한다. 셔플 deck은 이 이미지와 다른 후보만 필터링해 deterministic offset/step으로 정확히 12개를 만든다. `saving | shuffling | revealing` 동안 close 버튼이 제거되고 `useModalFocus.isDismissible=false`, backdrop/Escape 무효화, `stage !== confirm` 및 synchronous ref lock으로 반복 시작이 차단된다. 실패 outcome 또는 throw는 오류 문구와 함께 confirm으로 복귀하고 ref lock을 해제한다.

랜덤은 별도 gacha dialog를 열지만 특정 프로필 버튼은 기존 `pendingPurchase`/`StudentConfirmDialog`와 `SELECTED_PROFILE_CHANGE_PRICE = 50` 경로를 그대로 사용한다. 일반 전환은 저장 최소 600ms 뒤 `shuffleMs=1700`, `revealMs=500`; reduced는 셔플 0ms, opacity 공개 220ms다. `STUDENT_PROFILE_GACHA_MOTION`이 세 값을 소유하고 dialog inline style에 `--student-profile-gacha-{shuffle,reveal,reduced}`를 방출한다. 최신 런타임 관찰값 saving@250, shuffling@610, revealing@2309, result@2848은 이 상태기계 허용 오차와 일치한다.

최신 정상/동작 줄이기 결과 캡처를 직접 열어 1280×800 내부 배치, 결과 카드와 확인 동작을 확인했다. 결과 분기는 shuffling DOM과 상호 배타적이라 reel card 수는 0이다. reduced reveal의 motion variants는 opacity만 설정하고 `rotateY` transform을 넣지 않는다. `role=dialog`, `aria-modal`, labelledby/describedby, 처리 단계 `aria-busy`, 단일 polite live region, focus trap/return 및 result button focus가 구현되어 있다.

## criterionReview

| criterion | result | evidencePointer |
|---|---|---|
| RECEIPT_AUTHORITATIVE | PASS | `src/components/student/StudentProfileGachaDialog.tsx:185-228,378-469`; `src/lib/studentProfilePurchase.ts:23-32`; `src/pages/AuctionPage.tsx` purchase outcome adapter |
| DECOY_12_DETERMINISTIC_EXCLUDES_RESULT | PASS | `src/components/student/StudentProfileGachaDialog.tsx:63-81,120-123,344-352`; `src/lib/studentShopPresentation.test.ts:65-79` |
| PROCESS_LOCKS_AND_RETRY | PASS | `src/components/student/StudentProfileGachaDialog.tsx:110-117,131-138,165-200,272-276`; `src/lib/useModalFocus.ts` |
| DIRECT_50_GOMA_UNCHANGED | PASS | `src/components/student/StudentShopPage.tsx:179-205,246-264`; `src/lib/studentProfilePurchase.ts:16-17` |
| MOTION_NORMAL_AND_REDUCED | PASS | `src/components/student/StudentProfileGachaDialog.tsx:37-52,83-89,191-228,394-428`; runtime observations supplied for this re-gate |
| RUNTIME_MOTION_TOKENS | PASS | `src/components/student/StudentProfileGachaDialog.tsx:37-52,263`; `DESIGN.md:168-170,306` |
| FOCUS_ARIA | PASS | `src/components/student/StudentProfileGachaDialog.tsx:131-163,255-278,469`; latest 1280×800 result captures |
| QUALITY_GATES | PASS | Fresh `npm run lint`; `npm test` 389/389; `npm run build` exit 0 with only known >500kB chunk warning; `git diff --check` exit 0 |

## removeAiSlopsAndProgrammingReview

Direct pass completed over the scoped production code and tests. No tautological expected-value derivation, mock-only success, unnecessary parsing/normalization, dead production branch, type suppression, new dependency, or requested-result substitution was found. The deck test checks observable membership, exclusion, cardinality, and determinism rather than mirroring the indexing implementation. The presentation tests contain several negative markup assertions for removed/hidden UI and exact user copy; these are narrow UI-contract checks but some are deletion-oriented and create modest maintenance coupling. This is a NOTE, not a blocker, because no success criterion is violated and the runtime behavior has independent source/browser evidence.

`StudentProfileGachaDialog.tsx` is 479 physical lines and exceeds the programming skill's 250 pure-LOC guideline. The component is a bounded phase state machine, but its size is a maintenance NOTE; architecture size was not a stated success criterion and therefore cannot block this gate. No scope-expanding refactor is recommended in this read-only review.

The existing profile-specific code-review reports do not cover this new arcade motion-token revision or explicitly repeat the slop/overfit matrix. Per gate policy, this missing report coverage is not a blocker because the direct pass above and fresh validation independently support every stated criterion.

## checkedArtifactPaths

- `src/components/student/StudentProfileGachaDialog.tsx`
- `src/components/student/StudentShopPage.tsx`
- `src/lib/studentProfilePurchase.ts`
- `src/lib/studentShopPresentation.test.ts`
- `src/pages/AuctionPage.tsx`
- `src/lib/useModalFocus.ts`
- `src/index.css`
- `DESIGN.md`
- `tmp/visual-qa/profile-gacha/arcade-final-8/06-result-3100.png`
- `tmp/visual-qa/profile-gacha/arcade-reduced-harness-final-4/02-reduced-result.png`
- `.omo/evidence/profile-arcade-visual-gate-clone-fidelity.md`
- `.omo/evidence/profile-gacha-visual-gate-clone-fidelity.md`
- `.omo/evidence/profile-shop-functional-gate-rereview.md`

## exactEvidenceGaps

- `omo ulw-loop status --json` could not run because `omo` is not present in PATH, so the required ULW attempt directory could not be resolved. This report uses the documented no-plan fallback under `.omo/evidence/`.
- No machine-readable current runtime log containing the exact 250/610/2309/2848 observations was found. The assigned re-gate input supplies those fresh values; current source timing, post-source 1280×800 captures, and direct DOM branch inspection corroborate them. This is not a failed criterion.
- The latest result captures include a small bottom-center capture-tool overlay in the normal artifact; it is outside the product dialog and does not obstruct or alter the reviewed UI.

