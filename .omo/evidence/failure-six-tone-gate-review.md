# Failure Exhibition Six-Tone Gate Review

- recommendation: APPROVE
- blockers: []

## originalIntent

Failure Exhibition 탐색 레일을 화면에 보이는 이전/다음 문구 없이 직관적인 기호 전용 컨트롤로 만들되 접근 가능한 이름은 유지하고, 여섯 고정 배경색을 이야기의 안정적인 정체성과 canonical order에 따라 배정하여 모든 정착된 6장 화면이 여섯 색을 한 번씩 사용하게 한다. 이동, 자동 릴레이, 재로드, 본문 수정으로 기존 이야기의 색이 변하지 않아야 하며 실제 학생 데이터는 변경하지 않고, 1280x800에서 잘림·겹침·문서 스크롤이 없어야 한다.

## desiredOutcome

1280x800의 3x2 실패 이야기 전시에서 여섯 카드가 서로 다른 고정 톤을 사용하고, 오른쪽 레일은 좌우 화살표만 보이면서 스크린리더용 이름을 제공한다. 릴레이가 이동해도 공통 이야기의 톤은 유지되며 레이아웃과 실제 학생 데이터는 안전하다.

## userOutcomeReview

요청한 결과를 충족한다. `createdAt + id`로 만든 canonical oldest-first 순서에 0..5 톤을 반복 배정하고 ID로 조회하므로 입력 재정렬, 본문/updatedAt 변경, 정상적인 최신 글 추가와 재로드에서 기존 ID의 톤이 유지된다. 릴레이 offset을 `0..stories.length-6`의 완전한 연속 창으로 제한해 모든 정착된 6장 창이 여섯 톤을 한 번씩 포함한다. 탐색 버튼은 아이콘만 렌더링하고 `aria-label`을 유지한다. 제공된 1280x800 원본 화면에는 카드/레일 겹침, 잘림, 문서 스크롤이 보이지 않는다. 검토 및 검증은 읽기 전용으로 수행했으며 학생 데이터 변경 경로를 호출하지 않았다.

## checkedArtifacts

- `src/components/student/StudentFailureRelay.tsx`
- `src/components/student/StudentFailureMessage.tsx`
- `src/lib/failureStoryTone.ts`
- `src/lib/failureStoryTone.test.ts`
- `src/lib/failureExhibition.test.ts`
- `src/index.css`
- `DESIGN.md`
- `.omo/evidence/failure-six-tone-20260829/primary-1280x800-verified.png`
- `git diff --check` (PASS)
- `npm run lint` / `tsc --noEmit` (PASS)
- `npm test` (275/275 PASS)
- `npm run build` (PASS; pre-existing-style bundle-size warning only)

## directSlopAndProgrammingPass

- 과도하거나 무의미한 테스트, 삭제만 확인하는 테스트, 구현을 그대로 복제한 기대값, tautological assertion, 불필요한 파싱/정규화/추상화는 발견하지 못했다.
- 톤 순수 함수 테스트는 ID 안정성, canonical six-tone 분포, 재정렬·본문 수정·최신 추가 불변성을 관찰 가능한 Map 결과로 검증한다.
- SSR markup 테스트는 아이콘 전용 탐색의 접근 가능한 이름과 6장 DOM 톤 분포를 검증한다. 문자열 확인은 사용자 노출 문구가 아니라 접근성/DOM 계약을 대상으로 한다.
- 새 톤 모듈은 단일 책임이며 타입 억제, `any`, 비널 단언, 새 의존성, 학생 데이터 쓰기를 도입하지 않는다.

## evidenceGaps

- `omo ulw-loop status --json` 실행 파일이 환경에 없어 `currentAttemptDir`를 해석하지 못해 fallback 보고서 경로를 사용했다.
- 별도 code-review report/manual-QA matrix 파일은 입력으로 지정되지 않았다. 직접 코드·테스트·스크린샷 검토와 재실행된 게이트가 성공 기준을 충분히 입증하므로 blocker가 아니다.
- 1024/1366/유효 640 및 14회 자동 릴레이의 원시 로그는 지정 경로에 없고 입력 설명으로만 제공되었다. 핵심 승인 기준인 1280x800 증거와 코드/테스트를 직접 확인했으므로 blocker가 아니다.

