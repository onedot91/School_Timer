# Profile continuity function gate review

## recommendation

APPROVE

## blockers

None.

## originalIntent

랜덤 프로필 가챠에서 릴이 멈춘 가운데 물음표 카드가 그 자리에서 열려 실제 구매 결과를 보여 주고, 공개된 결과 카드가 별도 결과 카드로 교체되지 않은 채 결과 상태까지 이어져야 한다. 디코이 프로필은 당첨 결과처럼 보이면 안 되며, 구매 영수증이 결과 이미지의 유일한 권위 소스여야 한다. 처리 잠금, 접근성, reduced-motion 동작을 유지하고 실제 학생 데이터는 QA로 변경하지 않는다.

## desiredOutcome

사용자는 빠른 릴과 감속 뒤 중앙 물음표 카드가 잠기는 것을 보고, 같은 위치의 카드가 3D로 열려 저장된 프로필을 공개한 다음 그대로 결과 화면에 남는 하나의 연속된 경험을 본다. 정상 모션과 reduced-motion 모두 1280×800에서 잘림·겹침·불필요한 스크롤 없이 동작하며 결과 확인 버튼으로 포커스가 이동한다.

## userOutcomeReview

PASS. 최신 5개 정상 모션 프레임은 빠른 릴 → 감속 → 중앙 물음표 카드 잠금 → 같은 중앙 프레임의 3D flip → 정착 결과를 시각적으로 연속되게 보여 준다. 공개/결과 분기는 `stageLayoutKey === 'arcade'` 아래 같은 조건부 subtree를 유지하며, `stage`만 `revealing`에서 `result`로 바뀐다. 따라서 `.student-profile-gacha-winning-frame`과 그 안의 `.student-profile-gacha-flip-front`는 결과 전환 때 재마운트되지 않는다. 제공된 런타임 probe의 `continuityProbe: 'same-node'`, result focus `확인`, reel card 0개 관찰과 일치한다.

결과 이미지의 유일한 생산 입력은 성공한 `onPurchase()` outcome을 저장한 `receipt.profileImage`다. 공개 front face가 이를 직접 사용하고, result 상태도 동일 DOM을 유지하므로 별도 이미지 선택·정규화·대체 경로가 없다. 셔플 deck은 `profile.imageSrc !== resultImage`로 영수증 결과를 제외하고, 릴 DOM은 `aria-hidden`이며 결과 단계에는 `.student-profile-gacha-reel-card`가 남지 않는다. 즉 디코이는 선택 결과를 가장할 수 없다. 구매 로직의 성공 결과도 실제 선택된 `profileImage`를 영수증에 반환한다.

처리 중에는 `isDismissible=false`, close 미렌더, modal dismiss 차단, stage/ref 이중 시작 잠금이 유지된다. dialog ARIA, polite live region, `aria-busy`, 결과 버튼 focus가 유지된다. reduced-motion은 셔플을 0ms로 생략하고 transform 없는 220ms opacity 공개만 사용하며, 제공된 reduced 캡처에서 정적 결과와 확인 focus가 보인다.

## criterionReview

| criterion | result | evidencePointer |
|---|---|---|
| LOCKED_CARD_CONTINUES_TO_REVEAL | PASS | `src/components/student/StudentProfileGachaDialog.tsx:320-394,394-449`; `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0020.jpg`; `frame-0025.jpg` |
| RECEIPT_IMAGE_AUTHORITATIVE | PASS | `src/components/student/StudentProfileGachaDialog.tsx:185-228,394-447`; `src/lib/studentProfilePurchase.ts:102-153`; supplied runtime equality probe |
| DECOY_CANNOT_MASQUERADE | PASS | `src/components/student/StudentProfileGachaDialog.tsx:69-81,120-123,344-384`; `src/lib/studentShopPresentation.test.ts:65-80` |
| SAME_REVEALED_DOM_THROUGH_RESULT | PASS | `src/components/student/StudentProfileGachaDialog.tsx:118,280-291,394-475`; supplied `continuityProbe: 'same-node'` |
| LOCKS_ACCESSIBILITY_REDUCED_MOTION | PASS | `src/components/student/StudentProfileGachaDialog.tsx:103-173,176-229,255-278,394-473`; reduced capture |
| REAL_DOM_NO_IMAGE_FAKE | PASS | Current TSX/CSS implementation and six individual captures; no screenshot/canvas/background-image result substitution |
| VIEWPORT_1280x800 | PASS | All six assigned captures are 1280×800 and show no product clipping, overlap, unintended scroll, or first-screen overflow |
| QUALITY_GATES | PASS | Fresh `npm run lint`; `npm test` 389/389; `npm run build` exit 0 with only the existing >500kB chunk warning; `git diff --check` exit 0 |

## removeAiSlopsAndProgrammingReview

Direct review found no result-substitution helper, speculative parser/normalizer, dead result-card branch, type suppression, new dependency, or implementation-mirroring test added for this continuity behavior. The deck test asserts observable cardinality, source membership, exclusion of the selected receipt image, and determinism; it does not reproduce the index algorithm. No deletion-only or tautological test blocks approval. `StudentProfileGachaDialog.tsx` exceeds the programming skill's 250 pure-LOC guideline and contains a large phase renderer; this is a maintenance NOTE, not a blocker, because module size is not a stated success criterion and this gate is read-only. No code-review artifact was found that explicitly repeats the full slop/overfit matrix for this exact revision; the direct pass and fresh gates independently support the stated criteria, so this remains an evidence NOTE.

## checkedArtifactPaths

- `src/components/student/StudentProfileGachaDialog.tsx`
- `src/index.css`
- `DESIGN.md`
- `src/lib/studentProfilePurchase.ts`
- `src/lib/studentShopPresentation.test.ts`
- `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0005.jpg`
- `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0015.jpg`
- `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0020.jpg`
- `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0025.jpg`
- `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0030.jpg`
- `tmp/visual-qa/profile-gacha/arcade-continuity-reduced-final/01-reduced-mid-100.png`
- `.omo/evidence/profile-arcade-function-regate-gate-review.md`
- `tmp/visual-qa/profile-gacha/profile_arcade_visual_regate-manual-qa.md`

## exactEvidenceGaps

- `omo ulw-loop status --json` 실행은 `omo: command not found`로 불가능해 ULW attempt directory를 확인하지 못했다. 지침의 no-plan fallback인 `.omo/evidence/`에 이 보고서를 기록했다.
- 제공된 runtime probe 원문 로그 파일은 발견하지 못했다. 동일 노드·이미지 동일성·focus·reel 제거 관찰값은 할당 입력에만 있으며, 현재 React key/조건부 DOM 구조와 최신 캡처가 이를 독립적으로 뒷받침한다.
- 이전 manual QA 문서는 과거 `saving → shuffling` 중첩을 REVISE로 기록하지만, 이번 연속성 기준의 지정 캡처보다 오래된 `arcade-final-8` 증거다. 이번 지정 프레임에는 해당 전환이 포함되지 않으며, 현재 요청의 결과 연속성 실패를 입증하지 않으므로 blocker가 아니다.
- 정상 캡처 하단 중앙의 작은 검은 pill은 지정된 capture-tool overlay로 제품 UI 판정에서 제외했다.
