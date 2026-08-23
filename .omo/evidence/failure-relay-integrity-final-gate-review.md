# Failure relay integrity final gate review

- recommendation: REJECT (requested shorthand: REVISE)
- originalIntent: `#student-library`의 실패 전시관을 초등학교 3학년이 익명으로 실패와 다음 시도를 나누는 따뜻한 세로 릴레이로 제공하고, 최대 5개 DOM 창·7초 자동 전환·다중 정지 조건·수동 탐색·긴 글 펼침·새 이야기 알림·접근성 모달·23개 프로필·횟수 없는 도장·작성자 수정/삭제·책장 이동·기존 저장 호환을 실제 기능으로 완성한다.
- desiredOutcome: 1280×800@100%를 기준으로 1024/1366에서도 오버플로 없이 다섯 행이 읽히며, DESIGN.md에 지정된 두 질문만 쓰는 큰 모달과 모든 릴레이/접근성/저장 동작이 실제 DOM 및 기존 studentLife 저장 경계에서 작동하고 고마 상태를 바꾸지 않는다.

## User outcome review

릴레이, 익명 피드, 반응형 레이아웃, 모달 크기, 도장 메뉴는 제공된 9개 캡처와 소스에서 실제 구현으로 확인했다. 5개 창, 7초 타이머, hover/focus/touch/펼침/도장/작성·수정·삭제 중 정지, 키보드·휠·스와이프·버튼 탐색, 새 이야기 카운트, DOM 5개 제한, 23개 고정 프로필, 작성자 전용 수정·삭제, 클래스메이트 전용 단일 도장, 책장 해시 이동, studentLife 기반 Supabase/localStorage 저장, 고마 비변경 경로가 구현되어 있다. 그러나 작성/수정 모달의 두 질문이 DESIGN.md의 명시 문구와 일치하지 않아 사용자에게 약속된 작성 경험은 완성되지 않았다.

## Blockers

1. violatedCriterion: `DESIGN-FAILURE-MODAL-EXACT-PROMPTS`
   - observation: 계약은 `어떤 실패를 했나요?`와 `다시 해 본다면 무엇을 바꾸고 싶나요?`만 묻도록 명시하지만 실제 create/edit DOM은 `어떤 일이 있었나요?`와 `다시 한다면 무엇을 바꿔 볼까요?`를 렌더링한다.
   - evidencePointer: `DESIGN.md:213`; `src/components/student/StudentFailureExhibitionPage.tsx:173`; `src/components/student/StudentFailureExhibitionPage.tsx:185`; `.omo/evidence/failure-relay/final/modal-1280x800.png`; `.omo/evidence/failure-relay/final/edit-modal-1280x800.png`

## Direct remove-ai-slops / programming pass

- Production is real React DOM/state, not a screenshot or hardcoded visual fake.
- `failureExhibition.test.ts` tests observable windowing, authorization, normalization, and stamp toggle behavior. No deletion-only, requested-removal-only, prose-pin, tautological, snapshot, or implementation-mirroring assertion was found.
- No unnecessary dependency, parser, normalization layer, or speculative extraction was introduced for this feature.
- `StudentFailureExhibitionPage.tsx` and `StudentFailureRelay.tsx` are large (221/213 pure LOC) but remain below the skill's 250 pure-LOC threshold; this is not a stated product criterion and is not a blocker.
- Dedicated current code-review report/manual-QA matrix/notepad was not found. The direct source pass, nine required captures, provided runtime evidence, and reproduced gates establish the reviewed behavior except for the blocker above.

## Checked artifact paths

- `src/components/student/StudentFailureExhibitionPage.tsx`
- `src/components/student/StudentFailureRelay.tsx`
- `src/components/student/StudentFailureMessage.tsx`
- `src/lib/failureExhibition.ts`
- `src/lib/failureExhibition.test.ts`
- `src/lib/studentLife.ts`
- `src/pages/AuctionPage.tsx`
- `src/index.css` failure-exhibition and responsive/reduced-motion rules
- `DESIGN.md`
- All nine PNGs under `.omo/evidence/failure-relay/final/` named in the review brief
- `.omo/evidence/failure-feed-integrity-release-gate-review.md`

## Reproduced evidence

- `npm test`: PASS, 145/145
- `npm run lint`: PASS
- `npm run build`: PASS; existing >500 kB chunk warning only
- `git diff --check`: PASS
- banned assertion grep for the scoped test: clean
- 23 profile thumbnail files present; source maps student numbers 1–23 deterministically
- Persistence path updates only `studentLife.failureStories`; Supabase updater spreads the current settings object and local fallback writes normalized studentLife. No currency balance/history mutation is reachable from the failure handlers.

## Exact evidence gaps

- No capture can demonstrate the contractually required prompt text because production renders different text.
- No dedicated current code-review report explicitly documents the remove-ai-slops/programming coverage.
- No isolated runtime artifact was supplied for 200% text zoom or reduced-motion preference itself. These are notes, not additional blockers, because the requested review evidence and source CSS cover the named 1024/1280/1366 layouts and reduced-motion mechanism.
