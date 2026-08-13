# Student overview egg integration gate review

- recommendation: **APPROVE**
- user-facing verdict: **PASS**
- review type: design-system and functional integrity, read-only product review
- reviewed at: 2026-08-13 (Asia/Seoul)
- blockers: none

## originalIntent

학생 개요의 오른쪽 펫 알 카드를 제거하고, 16:9 캔버스의 나무 둥지 알을 선택하면 기존 알 성장/먹이기 모달을 열도록 연결한다. 실제 잔액·급식 상태는 QA에서 변경하지 않는다.

## desiredOutcome

1280×800에서 `.student-pet-card`가 0개이고, 보이는 둥지 알 위에 최소 44×44의 접근 가능한 hotspot이 있으며, 이를 선택하면 제목 `알 성장`, 진행률, `5 고마 먹이기` 버튼을 포함한 dialog가 열린다. 키보드 포커스와 닫기 동작이 유지되고 화면 overflow가 없어야 한다.

## userOutcomeReview

PASS. 현재 소스로 실행한 로컬 앱을 1280×800에서 직접 검사했다. `.student-pet-card`는 0개다. `.student-home-hotspot-egg`는 화면 좌표 `(58.5, 208.77)`에 `140.64×83.60px`로 렌더되어 44×44 기준을 충분히 만족하며, 캡처에서 왼쪽 상단 나무의 보이는 둥지와 알을 감싼다. hotspot은 네이티브 `button`이고 `tabIndex=0`, 동적 접근성 이름 `알 성장 0 / 100 고마. 알 성장 창 열기`를 가진다.

hotspot 클릭 후 dialog 1개가 열렸고 제목은 `알 성장`, 진행률 접근성 이름은 `알 성장 0 / 100 고마`, 버튼 문구는 `5 고마 먹이기`였다. 최초 포커스는 `펫 창 닫기` 버튼으로 이동했다. Escape로 닫은 뒤 포커스는 egg hotspot으로 복귀했다. modal open/closed 상태 모두 문서 크기가 viewport와 같은 `1280×800`이었고 수평·수직 overflow가 없었다. 급식 버튼은 클릭하지 않았고 잔액/펫 데이터를 변경하지 않았다.

## criteria

| id | criterion | result | evidencePointer |
|---|---|---|---|
| C1 | 오른쪽 `.student-pet-card` 제거 | PASS | live DOM count `0`; `src/components/student/StudentOverviewPage.tsx`에서 `StudentPetCard` import/render 제거 |
| C2 | 둥지 알 위 hotspot, 최소 44×44 | PASS | live rect `140.64×83.60`; `.omo/evidence/student-overview-egg-gate/overview-1280x800.jpg`; `src/index.css` `.student-home-hotspot-egg` |
| C3 | 선택 시 기존 `알 성장` dialog 열림 | PASS | live dialog count `1`, title `알 성장`; `.omo/evidence/student-overview-egg-gate/dialog-1280x800.jpg` |
| C4 | 진행률과 5고마 버튼 표시 | PASS | live progress aria-label `알 성장 0 / 100 고마`; button `5 고마 먹이기` |
| C5 | 키보드/접근성 | PASS | native button, `tabIndex=0`, descriptive `aria-label`; dialog `role=dialog`, `aria-modal=true`, labelled heading; initial close-button focus; Escape close and focus return |
| C6 | 1280×800 overflow 없음 | PASS | closed/open 모두 `scrollWidth=clientWidth=1280`, `scrollHeight=clientHeight=800` |
| C7 | 실제 데이터 미변경 | PASS | QA는 hotspot open과 Escape close만 수행; feed button 미클릭 |
| C8 | 정적 검증 | PASS | `npm run lint`, `npm run build`, `npm test`(68/68), `git diff --check` exit 0 |

## blockers

없음.

## direct remove-ai-slops / overfit pass

세 변경 파일의 관련 diff, production code, tests를 직접 검토했다. 이번 기능은 기존 modal 상태와 handler를 재사용하고 `onOpenEgg` prop 및 네이티브 button hotspot만 추가한다. 새 parser, normalizer, helper, dependency, speculative abstraction, broad catch, type suppression, debug residue는 없다. 이 요청을 위해 추가된 테스트는 없으므로 deletion-only test, 요청한 제거만 검증하는 test, tautological test, implementation-mirroring test, 과도한 fixture/test도 없다. 현재 프로젝트의 실제 브라우저 검증이 CSS selector 자체를 고정하는 테스트보다 적합하다.

`StudentPetCard.tsx`와 관련 CSS가 저장소에 남아 있지만 현재 `src`에서 import되지 않는다. 이는 정리 가능한 dead code NOTE이나, 요청은 오른쪽 섹션 제거와 canvas modal 연결이며 사용자-visible 성공 기준을 위반하지 않아 blocker가 아니다.

## direct programming pass

관련 TypeScript는 명시적 prop type과 기존 typed state를 유지하고 `any`, `@ts-ignore`, `@ts-expect-error`, non-null assertion을 추가하지 않는다. `onOpenEgg`는 기존 modal state seam을 직접 호출하여 불필요한 새 계층이 없다. `StudentOverviewPage.tsx`(270 pure LOC)와 전체 `src/index.css`는 programming 기준의 크기 NOTE이며, 이번 작은 통합의 구체적 성공 기준 실패는 아니다. `StudentPetStage.tsx`는 212 pure LOC로 warning band에 있다. 이 리뷰는 read-only이므로 구조 변경을 수행하지 않았다.

전체 `src/index.css` working-tree diff에는 이 요청 외의 다수 변경이 섞여 있다(428 additions/2 deletions). 관련 egg selector와 overview layout hunk만 현재 intent에 직접 귀속했으며, 다른 변경은 공유 dirty worktree의 별도 작업으로 취급했다.

## report coverage check

현재 egg-integration 변경에 정확히 대응하는 executor report, code-review report, manual-QA matrix, notepad path는 제공되거나 발견되지 않았다. 기존 `.omo/evidence` 보고서들은 이전 overview 상태를 다루며 현재 변경 승인의 대체 근거로 사용하지 않았다. 따라서 별도 보고서가 동일한 `remove-ai-slops`/`programming` 및 overfit criterion을 명시했다는 확인은 불가하다. 다만 본 gate의 직접 diff/runtime/slop/programming 검토가 모든 stated criterion을 지지하므로 이는 evidence gap이지 blocker가 아니다.

## checked artifact paths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/useModalFocus.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-egg-gate/overview-1280x800.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-egg-gate/dialog-1280x800.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/`

## exact evidence gaps

- `omo ulw-loop status --json`를 실행하려 했으나 workspace에서 `omo` command가 없어 ULW attempt directory를 얻지 못했다. 지침에 따라 fallback report path를 사용했다.
- 현재 변경에 대한 별도 executor evidence, code-review report, manual-QA matrix, notepad path가 없다.
- in-app browser의 합성 Enter/Space keypress가 focused native button에서 click을 발생시키지 않아 keypress 자체는 자동화로 재현하지 못했다. 네이티브 `<button type="button">`, 실제 tab focus, focus-visible 상태, modal focus trap, Escape close, focus return은 직접 확인했다. 소스에 Enter/Space를 막는 handler는 없다.
- 정적/security scanner는 프로젝트에 별도 설정이 없어 N/A다.

## verification

- `npm run lint`: PASS (`tsc --noEmit`)
- `npm run build`: PASS; 기존 Vite 500kB chunk warning만 있음
- `npm test`: PASS, 68 passed / 0 failed
- `git diff --check -- <reviewed files>`: PASS
- image signatures/dimensions: JPEG, 1280×800, source보다 최신
- live browser QA: PASS; no feed/data mutation
