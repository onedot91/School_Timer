# Library receive confirmation + reflection integrity review

## recommendation

PASS

## originalIntent

학생이 새 책의 제목·글쓴이·필수 한 줄 감상을 입력한 뒤 `책 받기`를 누르면 즉시 운반하지 않고 기존 확인 대화상자에서 한 번 더 확인한다. 취소 계열 동작은 입력을 보존한다. 쪽수 입력은 제거하고 새 책에 가상 쪽수를 만들지 않으며, 기존 양수 쪽수 책은 그대로 보존한다. 한 줄 감상은 로컬/공유 저장, 응답 검증, 재시도, 월별 보관 및 다시 읽기 화면까지 유지한다. 운영 데이터나 스키마는 변경하지 않는다.

## desiredOutcome

- 새 책 등록 폼에는 쪽수 대신 1~100자의 필수 단일행 감상이 있다.
- 폼 제출은 확인창까지만 진행하고 `확인하고 받기`에서만 운반이 시작된다.
- `다시 수정`, Escape, X, 배경 클릭은 세 입력값을 유지한 등록 폼으로 돌아간다.
- 화면에는 동시에 하나의 `aria-modal`만 존재하며 키보드 포커스가 갇히고 적절히 복귀한다.
- 신규 책은 `pageCount: 0`과 유효한 `reflection`으로 저장되고, 레거시 책의 기존 `pageCount` 및 필드가 보존된다.
- 감상은 서버 명령 파싱, 멱등 재시도 비교, authoritative response 검증, JSON 복원, 경쟁 보관 및 상세/독서 화면에 남는다.

## userOutcomeReview

소스와 현재 증거를 직접 대조한 결과 위 결과가 구현되어 있다. `CanvasLibraryGame.tsx`의 `registerBook`은 검증된 draft를 `confirm-registration` 상태로 전환할 뿐 운반을 시작하지 않는다. 확인창의 명시적 confirm만 `carryExistingBook`을 호출한다. 취소 경로는 `registration` 모달로 돌아가며 React 입력 state를 비우지 않는다. 기존 `StudentConfirmDialog`가 `useModalFocus`를 통해 Escape, focus trap, dismiss, focus return을 담당하고 조건부 렌더링 구조상 등록창과 확인창은 동시에 열리지 않는다.

신규 draft는 `pageCount: 0`과 trim된 감상을 사용한다. 저장/명령/응답 계층은 `normalizeBookReflection`을 공통 경계로 사용하며, 감상이 없는 `pageCount: 0`은 거부하고 양수 쪽수 레거시 책은 허용한다. `StudentLibraryPage`의 배치/미배치 변환, 월별 archive response/local archive 정규화, 챌린지 archive UI, 독서 코너 및 책 상세가 감상을 전달하거나 표시한다. 운영 서비스 호출·DB 변경·마이그레이션은 검토 중 수행하지 않았다.

1280x800 현재 캡처 11개는 모두 유효한 PNG이며 지정 크기다. 확인창, 빈 감상 오류, 필드 보존, 긴 입력, 200% 확대 내부 스크롤, 명시적 확인 후 운반, 직접 이동·배치, 상세 감상 표시를 포함한다. 결합 소스 해시는 `4a22d6b4cfefeaa32dd1f1ade58f781e1bbad5188c556a41342ef416e294e433`으로 `after.json`의 시작/종료 해시와 일치한다.

## blockers

없음.

## direct remove-ai-slops / programming pass

- `src/lib/bookReflection.test.ts`는 명령 파싱, 저장 정규화, 보상/JSON 왕복, 멱등 동일성, 로컬 저장, 공유 receipt/authoritative mismatch와 retry identity라는 관찰 가능한 경계를 검증한다. 삭제만 확인하는 테스트, 요청 문구만 고정하는 테스트, tautology, production 결과로 기대값을 재계산하는 테스트는 아니다.
- 일부 반복 테스트가 command와 stored-data rejection을 한 테스트에서 함께 확인하는 것은 Given/When/Then 순수성 측면의 NOTE지만, 두 실제 trust boundary를 독립 생산 코드로 통과시키며 성공 기준에 거짓 확신을 주지 않는다.
- `normalizeBookReflection`은 UI·저장·서버 명령·응답이 공유해야 하는 실제 외부 데이터 경계라 불필요한 parser/normalizer가 아니다. 감상 필드를 각 레이어에서 별도 재구현하지 않는다.
- 새 dependency, type suppression, `any`, 로깅, dead wrapper, speculative abstraction 또는 운영 부작용은 발견하지 못했다.
- `studentLife.ts`, `canvasLibraryWorld.ts`, `canvasLibraryClient.ts`, `CanvasLibraryGame.tsx`, `index.css`는 이미 250 pure LOC를 넘는 대형 파일이다. 이번 명시된 좁은 변경에서 구조 리팩터링은 요청 범위를 벗어나며 사용자 기능 기준 실패가 아니므로 NOTE다.
- 별도 current-scope code-review report는 제공된 디렉터리에서 확인하지 못했다. 따라서 보고서 자체의 동일 skill-perspective coverage는 확인 불가하지만, 본 검토가 해당 범위와 overfit/slop 항목을 직접 수행했으므로 blocker가 아니다.

## reproducedChecks

- `node --import tsx --test src/lib/bookReflection.test.ts src/lib/canvasLibraryWorld.test.ts src/lib/canvasLibraryPlacement.test.ts src/lib/canvasLibraryClient.test.ts src/lib/studentLife.test.ts src/lib/bookStackMission.test.ts`: PASS, 97/97.
- `git diff --check`: PASS.
- `cat CanvasLibraryGame.tsx index.css | shasum -a 256`: `4a22d6...a433`, `after.json`과 일치.
- `file .omo/evidence/library-receive-confirm/*.png`: after 11개 및 before 2개 모두 PNG 1280x800.
- 제공된 root gate 결과(`lint`, 전체 687 tests, `build`, diffcheck)는 supporting evidence로 확인했으며, 본 검토에서는 focused suite와 diffcheck를 재실행했다.

## checkedArtifactPaths

- `src/components/student/library/CanvasLibraryGame.tsx`
- `src/components/student/StudentLibraryPage.tsx`
- `src/components/student/library/LibraryCompetitionPanel.tsx`
- `src/components/student/StudentConfirmDialog.tsx`
- `src/index.css`
- `src/lib/studentLife.ts`
- `src/lib/bookStackMission.ts`
- `src/lib/canvasLibraryWorld.ts`
- `src/lib/canvasLibraryPlacement.ts`
- `src/lib/canvasLibraryClient.ts`
- `src/lib/bookReflection.test.ts`
- `src/lib/libraryCompetitionResponse.ts`
- `src/lib/libraryCompetitionLocalArchive.ts`
- `.omo/evidence/library-receive-confirm/qa.mjs`
- `.omo/evidence/library-receive-confirm/fixture.tsx`
- `.omo/evidence/library-receive-confirm/before.json`
- `.omo/evidence/library-receive-confirm/after.json`
- `.omo/evidence/library-receive-confirm/report.md`
- `.omo/evidence/library-receive-confirm/storage.md`
- `.omo/evidence/library-receive-confirm/after-*.png`

## exactEvidenceGaps

- 별도의 이 범위 전용 code-review report/notepad는 발견하지 못했다.
- 전체 687-test, lint, build는 전달된 root 결과이며 본 검토에서 다시 전체 실행하지 않았다. focused 97-test와 diffcheck는 재현했다.
- 전용 QA는 합성 fixture를 사용한다. 실제 운영 DB 왕복은 의도적으로 수행하지 않았고, 서버 parser/commit 경계는 소스 및 격리 client/domain 테스트로 확인했다.

이 공백들은 명시된 성공 기준의 실패 증거가 아니며 PASS를 막지 않는다.
