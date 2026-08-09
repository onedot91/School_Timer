# Student Overview Refactor — Gate Review Pass A

- recommendation: REJECT (REVISE)
- blockers:
  - violatedCriterion: C6 — existing `DESIGN.md` tokens and styles remain coherent
    evidencePointer: `DESIGN.md:46-49`, `src/index.css:14752-14766`, `src/index.css:14768-14861`, `src/index.css:15082-15176`
    observation: `--emotion-yellow` is `#b47b08` in production but `#c18a12` in the contract, and the overview character/balance/emotion override block is duplicated later in the same stylesheet. The second copy is required only to override an intervening legacy summary block, creating an order-dependent, internally incoherent cascade.

## originalIntent

학생 개요에서 캐릭터 영역을 확대하고, overview에는 오늘 선택한 감정 구슬 하나만 표시하며, 과도하게 큰 고마 잔액 색상 블록을 작고 조용한 요약으로 줄인다. 375×812, 768×900, 1280×900에서 반응형 배치, 기능 연결, 한국어 표시, 접근성 이름, 수평 오버플로, `DESIGN.md` 토큰 일관성을 확인한다.

## desiredOutcome

캐릭터가 첫 시각 초점이어야 하고, 잔액은 보조 정보여야 하며, overview 감정 진입점에는 선택 구슬 하나만 보여야 한다. 세 viewport에서 콘텐츠가 잘리거나 가로로 넘치지 않고, 실제 DOM 버튼과 명확한 접근성 이름을 사용하며, 스타일은 기존 디자인 계약의 토큰과 하나의 명료한 cascade로 유지돼야 한다.

## userOutcomeReview

- 캐릭터 확대: PASS. 세 캡처 모두 캐릭터 카드가 가장 큰 상단 요소다. 375px에서는 전체 폭으로, 768/1280px에서는 compact balance 옆의 주 열로 표시된다. Source: `StudentOverviewPage.tsx:39-53`, `index.css:15082-15094`.
- 선택 감정 구슬만 표시: PASS. overview DOM은 `StudentEmotionSummary` 하나를 렌더하고 선택 상태에서는 `StudentEmotionOrbVisual` 하나만 보인다. 감정명과 변경 동작은 `aria-label`/`title`로 제공된다. Source: `StudentOverviewPage.tsx:55`, `StudentEmotionSummary.tsx:15-28`.
- 잔액 블록 축소: PASS. 기존 채도 높은 대형 패널 대신 4rem compact 흰색 카드와 녹색 텍스트가 표시된다. Source: `StudentBalanceSummary.tsx:23-42`, `index.css:15096-15136`.
- 반응형/CJK/오버플로: PASS for supplied captures. 375px은 hero와 목적지 카드가 1열, 768/1280px은 목적지 카드가 2열이다. 한국어 문구의 잘림, 겹침, 한 글자 고립, tofu glyph, 가로 스크롤은 보이지 않는다. 375px의 세로 scrollbar와 아래로 이어지는 두 번째 카드는 정상 세로 문서 흐름이다.
- 기능/접근성: PASS by source trace. orb은 실제 `button type="button"`이며 `onClick={onOpen}`이 `AuctionPage.tsx:840`의 `navigateStudentView('emotions')`로 연결된다. 영역은 `aria-label="오늘의 감정"`, 버튼은 선택 감정명과 변경 목적을 포함한 이름을 가진다.
- 디자인 토큰/스타일 일관성: REVISE. 실제 yellow token과 계약값이 다르고, 동일 overview override가 두 벌 존재한다. 화면 픽셀은 현재 정상이어도 cascade 순서에 의존해 유지보수와 이후 변경의 예측 가능성을 해친다.

## directRemoveAiSlopsAndProgrammingPass

- `remove-ai-slops` 직접 검토: 추가된 `studentEmotion.test.ts`는 정규화/병합 경계를 테스트하며 삭제 요청만 확인하는 테스트, tautological test, overview 구현을 그대로 복제한 테스트는 아니다. 이번 overview 시각 변경을 위한 불필요한 parser/normalizer/extraction도 없다.
- 발견된 production slop: `src/index.css:14768-14861`과 `15082-15176`에 동일 overview override가 중복된다. 중간의 `14863-14888` legacy summary 규칙을 다시 덮기 위해 파일 끝 복사본에 의존한다. 이는 duplication 및 order-dependent cascade다.
- `programming` 직접 검토: React DOM 연결과 타입은 명시적이며 `as any`, type suppression, 새 의존성은 없다. `npm run lint`와 전체 `npm test`는 통과했다. `git diff --check`도 깨끗하다.
- 기존 Pass B 보고서 `.omo/evidence/student-overview-refactor-pass-b-gate-review.md`는 시각/CJK 결과를 확인하지만 programming 및 overfit/slop 기준을 명시적으로 다루지 않는다. 본 Pass A의 직접 검토가 그 공백을 보완하며, 중복 CSS를 별도 finding으로 확인했다.
- NOTE: `src/index.css`의 전체 크기는 `DESIGN.md:175-176`에서 accepted legacy debt로 명시돼 있어 그 사실 자체는 blocker로 취급하지 않았다. 이번 blocker는 새 overview 규칙의 중복과 계약 토큰 불일치에 한정한다.

## verification

- `npm run lint`: PASS (`tsc --noEmit`, exit 0)
- `npm test -- --runInBand`: PASS (36 passed, 0 failed)
- `git diff --check`: PASS
- `npm run build`: NOT RUN. Read-only review이며 build는 `dist/`를 갱신하므로 실행하지 않았다.
- Static/security scanner: N/A; 프로젝트에 별도 scanner가 구성돼 있지 않다.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-refactor-375.png` — PNG RGB 375×812, 직접 열어 확인
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-refactor-768.png` — PNG RGB 768×900, 직접 열어 확인
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-refactor-1280.png` — PNG RGB 1280×900, 직접 열어 확인
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-refactor-pass-b-gate-review.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBalanceSummary.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentEmotionSummary.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentEmotionOrb.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`

## exactEvidenceGaps

- `omo ulw-loop status --json` 명령이 설치돼 있지 않아 `currentAttemptDir`을 조회하지 못했고 fallback report path를 사용했다.
- 이 exact capture set에 대한 별도 executor code-review report, manual QA matrix, task notepad path는 제공되지 않았다. Pass B 보고서와 본 직접 source/screenshot 검토가 사용자 기준 대부분을 재현했지만, Pass B에는 slop/programming coverage가 없다.
- 제공 캡처는 정적 화면이므로 keyboard focus ring과 orb click 후 hash navigation의 실제 브라우저 동작은 캡처만으로 재생하지 못했다. 연결은 DOM/source로 추적했다.
- 320/390/1024/1440px 및 200% text zoom 캡처는 이번 요청에 제공되지 않아 검증하지 않았다. 요청된 세 viewport의 판정에는 영향을 주지 않으며 NOTE다.

## recommendation

REJECT (REVISE). 화면 결과는 의도에 맞지만 C6가 실패한다. `--emotion-yellow`를 계약값과 일치시키고, overview override를 한 위치로 통합해 legacy summary 규칙보다 명확하게 뒤에 두거나 기존 규칙을 정리한 뒤 동일 세 viewport를 다시 캡처해야 한다.
