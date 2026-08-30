# Teacher Character Messages Final Integrity — Gate Review

- recommendation: APPROVE
- verdict: PASS
- role: final gate reviewer (read-only product review; only this report artifact was written)
- review date: 2026-08-30

## originalIntent

교사 설정의 `기타 > 캐릭터`에서 등록된 각 교실 캐릭터에 해당 캐릭터만의 고유 멘트를 표시하고, 1~23번 모든 슬롯이 등록 여부와 무관하게 동일한 캐릭터 영역과 멘트 영역을 유지해야 한다.

## desiredOutcome

- 1~23번 카드가 고정 번호순으로 모두 렌더링된다.
- 등록된 19개 캐릭터는 비어 있지 않고 서로 다른 멘트를 표시한다.
- 미등록 14, 17, 19, 20번도 `캐릭터 대기`와 `멘트 대기` 공간을 유지한다.
- 1280×800에서 5열, 카드 높이 136px, 내부 스크롤 소유 구조로 잘림·겹침·문서 overflow가 없다.
- 실제 캐릭터 데이터/이미지/멘트가 재사용되며 자캐 이름이나 가짜 편집 UI를 새로 만들지 않는다.
- 화면 읽기 사용자가 번호, 등록 상태, 멘트를 이해할 수 있다.

## userOutcomeReview

PASS. 최종 두 PNG를 원본 1280×800로 직접 확인했다. 상단 캡처는 1~15번, 하단 캡처는 11~23번을 겹쳐 포함하여 전체 23개 슬롯을 시각적으로 증명한다. 모든 카드가 동일한 세 행(번호/캐릭터 무대/멘트)과 같은 높이를 사용하고, 14·17·19·20번은 점선 캐릭터 자리와 별도 멘트 자리를 그대로 보존한다. 등록 카드의 멘트는 모두 읽을 수 있고 카드/글자의 잘림이나 겹침이 보이지 않는다. 화면 바깥 문서가 아니라 `.teacher-shop-character-grid`가 세로 스크롤을 소유한다.

소스 흐름도 실제 데이터 재사용이다. `getStudentCharacterRoster()`가 `STUDENT_CHARACTERS`를 1~23번 슬롯으로 투영하고, `TimerPage.tsx`는 그 객체의 `imageSrc`, `alt`, `speech`를 직접 렌더링한다. 별도의 가짜 이름/멘트 데이터나 편집 컨트롤은 없다. 9번의 새 `speech`는 걷는 화면에서 `speechImageSrc`가 우선되는 기존 분기를 보존하므로 말풍선 UI를 중복시키지 않는다.

접근성은 등록 카드의 `aria-label`에 번호와 멘트가 포함되고 이미지에 기존 구체적 `alt`가 유지된다. 미등록 카드는 `캐릭터와 멘트 등록 대기`로 이름 붙고 화면에도 `캐릭터 대기`, `멘트 대기`가 텍스트로 남아 색상에만 의존하지 않는다.

## successCriteria

| id | criterion | result | evidencePointer |
|---|---|---|---|
| C1 | 1~23번 모든 슬롯 렌더링 | PASS | `src/lib/studentCharacters.ts:277-291`; 직접 실행 결과 `slots: 23` |
| C2 | 등록된 각 캐릭터의 비어 있지 않은 고유 멘트 | PASS | `src/lib/studentCharacters.ts:20-268`; 직접 실행 결과 `characters: 19`, `nonempty: 19`, `unique: 19`; 테스트 PASS |
| C3 | 미등록 번호도 동일한 캐릭터+멘트 예약 공간 유지 | PASS | `src/pages/TimerPage.tsx:9269-9291`; `src/index.css:23236-23247`; 직접 실행 `missing: [14,17,19,20]`; 두 최종 PNG |
| C4 | 1280×800에서 5열·동일 136px 카드·내부 스크롤·무 clipping/overflow | PASS | `src/index.css:23236-23247`; 두 최종 PNG; 제공 최종 DOM 측정(23 cards, 5 columns, heights 136px, clipped/overflow empty, document overflow 0/0)과 캡처가 일치 |
| C5 | 실제 데이터/토큰 재사용, 가짜 UI 없음 | PASS | `src/pages/TimerPage.tsx:9272-9289`; 기존 `--teacher-*`, `--apple-*` 토큰 사용; 편집/저장/가상 데이터 없음 |
| C6 | 접근 가능한 상태 및 멘트 | PASS | `src/pages/TimerPage.tsx:9275-9287`; 텍스트 placeholder, 구체적 image alt, 카드 aria-label |
| C7 | 타입 검사·테스트·빌드·diff 무결성 | PASS | reviewer fresh run: tests 387/387, `npm run lint`, `npm run build`, `git diff --check` |

## blockers

None.

## checkedArtifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentCharacters.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx` (character panel and walking speech-image branch)
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css` (teacher character grid/card/stage/message rules)
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentCharacterRoster.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/teacher-character-messages-1280x800.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/visual-qa/teacher-character-messages-bottom-1280x800.png`
- focused `git diff` for the five named source/document files
- reviewer commands: full `npm test`, `npm run lint`, `npm run build`, `git diff --check`, direct TS roster audit

## removeAiSlopsAndProgrammingPass

- Direct deletion/reuse check: roster projection and existing character fields are reused; no parallel copy of the domain data exists.
- Obvious comments/dead code/over-defensive code: none introduced in the reviewed feature hunk.
- Complexity/abstraction/boundary: the small inline map render is appropriate; no new helper, state layer, dependency, parser, normalization layer, or public API was added.
- Duplication/performance: fixed 23-slot map is bounded and linear; no repeated I/O or unnecessary collection chain was introduced.
- Types: no `any`, suppression, non-null assertion, enum, or unsafe assertion was added. The optional `speech` remains an existing domain compatibility shape; current registered roster completeness is behavior-locked by the data test.
- Functional integrity: the 9번 speech-image path remains governed by `shouldUseSpeechImage`, so adding its textual speech for the teacher roster does not create an extra walking speech bubble.
- Test slop NOTE: the fourth test reads TSX/CSS source and asserts regex fragments. Those assertions mirror implementation and can create false confidence after behavior-preserving markup/CSS refactors. This is not a blocker because C1/C2 have direct data behavior checks and C3-C6 are independently supported by final runtime screenshots, direct source review, and supplied DOM measurements. No stated success criterion requires a particular test implementation.
- Oversized-file NOTE: `TimerPage.tsx` and `index.css` are pre-existing large project-local surfaces. This feature adds a narrow existing-pattern render/CSS hunk; module-size taste is outside the stated success criteria and therefore is not a blocker.

## reportCoverageReview

No task-specific executor code-review report, manual QA matrix, or notepad artifact was found under `.omo/evidence` for this exact goal. Per gate policy, that absence is not independently blocking because this review directly inspected the diff, production source, tests, final visual artifacts, and reproduced the quality gates plus the remove-ai-slops/programming perspectives.

## exactEvidenceGaps

- The supplied DOM metrics were included in the review brief but were not stored in a task-specific JSON/text artifact alongside the PNGs. The reviewer could corroborate them against CSS geometry and both captures, but did not independently drive a browser because no browser automation dependency is installed in this workspace.
- No exact-goal code-review report explicitly records the remove-ai-slops/programming coverage.
- No exact-goal manual QA matrix or notepad path was supplied or discovered.

These are evidence hygiene NOTES, not blockers: none contradicts a stated criterion, and the required user-visible outcome is independently demonstrated by the checked artifacts and fresh reviewer commands.

## finalRecommendation

APPROVE / PASS. No criterion-linked blocker found.
