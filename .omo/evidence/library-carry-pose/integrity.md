# Library carry pose integrity review

- verdict: PASS
- recommendation: APPROVE
- blockers: []

## originalIntent

책을 든 곰 캐릭터에서 일반 걷기 팔·손·책이 중복되어 몸 뒤/위로 겹쳐 보이는 시각 오류를 없애고, 좌우 스카프 끝이 캐릭터 진행 방향 뒤로 향하도록 고친다. 기존 곰 정체성, 빈손 상태(요청된 스카프 끝 제외), 발 접지, 인벤토리·배치 동작은 보존한다.

## desiredOutcome

네 방향과 정지/보행/감소 모션에서 운반 자세가 하나의 안정된 자세로 읽히고, 정면·옆면에서는 손이 책을 자연스럽게 잡으며, 후면에서는 앞에 든 책이 보이지 않는다. 좌우 스카프와 옆 가방은 각각 진행 방향 뒤/책 반대편에 위치하며 실제 게임의 수령·이동·배치·가림 동작은 회귀하지 않는다.

## userOutcomeReview

직접 확인한 방향별 확대 화면에서 책 운반 팔은 한 쌍의 고정된 받침 자세로 보이며 별도 걷기 팔이 중복되지 않는다. 좌/우 화면의 책 양쪽 손과 반대편 가방이 분리되어 있고, 후면 화면에서는 파란 책이 완전히 가려진다. 스카프 끝은 왼쪽을 볼 때 화면 오른쪽, 오른쪽을 볼 때 화면 왼쪽에 있어 뒤로 흐른다. 실제 게임 화면의 수령 완료, 네 방향 보행 중간 프레임, 배치 완료, 책장 앞/뒤 가림도 직접 열어 보았고 캐릭터 파손·클리핑·접지 이탈을 발견하지 못했다.

## criterionReview

| criterion | result | evidencePointer |
|---|---|---|
| CR-1 중복 팔/손 제거 및 안정된 운반 자세 | PASS | `CanvasLibraryRenderer.ts:791-803,843-853`; `detail-left.png`, `detail-right.png`, `detail-down.png`; `final.json` `holdingArmsStable:true` |
| CR-2 후면에서 앞 책 가림 | PASS | `CanvasLibraryRenderer.ts:843`; `detail-up.png`; `before.json` `backBookOccluded:false` → `final.json` `backBookOccluded:true` |
| CR-3 옆 가방을 책 반대편에 배치 | PASS | `CanvasLibraryRenderer.ts:835`; `detail-left.png`, `detail-right.png` |
| CR-4 좌우 스카프가 진행 방향 뒤로 향함 | PASS | `CanvasLibraryRenderer.ts:824`; `detail-left.png`, `detail-right.png`; `final.json` `scarfTrailsBehind:true` |
| CR-5 빈손 정체성·발 접지 보존 | PASS | `final.json` `unladenPreserved:true`; down/up 빈손 PNG byte-identical, left/right는 QA가 스카프 영역을 제외한 픽셀 동일성을 검증; `CanvasLibraryRenderer.ts:771-788` 발 기준 유지 |
| CR-6 인벤토리·배치 및 실제 게임 회귀 없음 | PASS | `play-qa.json` `passed:true`, 52 screenshots, `errors:[]`, `carryRetained:true`, `bookIDsPreserved:true`; 직접 확인 `play-receive-settled.png`, `play-placed.png`, `play-behind-shelf.png`, `play-in-front-of-shelf.png` |
| CR-7 현재 소스 기반의 완전한 시각 패킷 | PASS | `final.json` 20 frames + `play-qa.json` 52 screenshots = 72 PNG; 모두 1280x800; stale count 0; renderer SHA-256 `d5014598...44b17`가 현재 파일과 일치 |

## directSlopAndProgrammingPass

- 변경된 `drawBear` 운반 분기는 요청된 렌더링 행위에 직접 필요하며 삭제·표준 라이브러리 대체 대상이 아니다.
- 새 추상화, 새 의존성, 디버그 코드, broad/empty catch, `any`, 타입 우회, 불필요한 정규화·파싱은 없다.
- QA는 삭제 여부나 소스 문자열을 고정하지 않는다. 실제 프로덕션 렌더러를 불러와 픽셀/화면 결과를 검사한다. `backBookOccluded`는 전 상태에서 실제로 실패하고 최종에서 통과하며, 빈손 비교·보행 단계 비교·방향별 가시성 검사는 서로 다른 observable 결과를 검증해 tautology나 구현 미러링으로 판단되지 않는다.
- `CanvasLibraryRenderer.ts`는 1051 pure LOC로 skill의 250 LOC 기준을 넘지만, 이번 요청은 기존 대형 canvas renderer의 한 함수에 대한 좁은 시각 버그 수정이고 구조 분리는 명시적 범위 밖 대규모 리팩터링이다. 이 자체는 사용자 성공 기준 실패가 아니므로 NOTE로만 기록한다.
- 변경 함수는 길고 좌표 분기가 많지만 픽셀 캐릭터의 단일 렌더 책임 안에 있고, 이번 수정은 기존 좌표 기반 관례를 따른 최소 범위 수정이다.

## checkedArtifacts

- `src/components/student/library/CanvasLibraryRenderer.ts` lines 769-854
- `.omo/plans/library-carry-pose.md`
- `.omo/evidence/library-carry-pose/report.md`
- `.omo/evidence/library-carry-pose/qa.mjs`
- `.omo/evidence/library-carry-pose/before.json`
- `.omo/evidence/library-carry-pose/final.json`
- `.omo/evidence/library-carry-pose/play-qa.json`
- 방향별 `detail-{left,right,up,down}.png`
- 실제 게임 `play-receive-settled.png`, `play-walk-{left,right,up,down}-mid.png`, `play-placed.png`, `play-behind-shelf.png`, `play-in-front-of-shelf.png`
- 전체 72개 최종 PNG의 signature/dimensions/freshness와 `play-qa.json`에 기록된 13개 소스 SHA-256을 현재 파일에 대조

## exactEvidenceGaps

- 별도 code-review 보고서가 없고 `report.md`에도 remove-ai-slops/programming 관점의 명시적 체크리스트는 없다. 본 게이트가 소스·QA 코드·렌더 증거를 직접 검사해 해당 관점을 충족했으므로 blocker는 아니다.
- `npm run lint`, 669/669 tests, `npm run build`, `git diff --check`의 원시 로그 파일은 이 디렉터리에 없다. `report.md`의 성공 요약만 존재한다. 요청된 시각 결과와 회귀 기준은 현재 해시의 72개 실제 렌더 증거와 `play-qa.json`으로 직접 재현되어 있어 blocker로 승격하지 않는다.
- `omo ulw-loop status --json` 명령은 현재 환경에서 `omo` 실행 파일을 찾지 못했다. 따라서 요청자가 지정한 `.omo/evidence/library-carry-pose/integrity.md`에 보고서를 기록했다.

## blockers

없음.
