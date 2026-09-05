# 독립 시각 검토 — 책 운반 곰·스카프 방향

## recommendation

**PASS**

## originalIntent

책을 든 곰에게 팔이 중복되거나 서로 겹쳐 보이는 문제, 뒤를 볼 때 책이 등 위에 그려지는 문제를 없애고, 측면 스카프 끝이 바라보는 방향의 뒤쪽으로 향하도록 좌우 반전한다. 기존 곰의 인상, 빈손 자세, 발 접지와 실제 도서관 화면 동작은 유지한다.

## desiredOutcome

- 책 운반 시 방향별로 팔 두 개와 손 두 개만 자연스럽게 책을 받친다.
- 뒤보기에서는 책이 몸 뒤에 완전히 가려진다.
- 왼쪽 보기 스카프 끝은 오른쪽, 오른쪽 보기 스카프 끝은 왼쪽에 있다.
- 빈손 캐릭터는 명시된 스카프 끝 영역 외 기존 픽셀과 동일하고, 발과 그림자가 바닥에 안정적으로 붙는다.
- 실제 1280×800 앱 화면에서 이동·운반·배치·가림·독서·모달·200% 텍스트 상태에 신규 겹침, 잘림, 화면 넘침이 없다.

## userOutcomeReview

20개 최종 렌더 프레임을 각각 원본 크기로 열고, 네 방향 확대 crop도 직접 확인했다. 정면은 양손이 책 양끝을 받치며 팔이 추가로 돌출되지 않는다. 좌우 측면은 바깥팔과 안쪽팔이 하나씩 이어져 책을 잡고, 가방은 반대 엉덩이에 있어 손·책과 충돌하지 않는다. 뒤보기에서는 파란 책 픽셀이 전혀 보이지 않아 책이 등에 덧칠된 인상이 사라졌다. 네 방향의 정지·walk A·walk B·reduced-motion 사이 운반 팔은 안정적으로 유지되고, 걷기 변화는 발 위치에만 나타난다.

왼쪽 보기의 스카프 끝은 캐릭터 오른쪽, 오른쪽 보기의 스카프 끝은 캐릭터 왼쪽에 있어 모두 진행 방향의 뒤쪽으로 흐른다. 앞·뒤 스카프 위치는 유지됐다. 빈손 네 방향과 운반 네 방향 모두 귀·얼굴·몸통·가방·발·그림자가 기존 픽셀 곰의 정체성과 접지를 유지한다.

`play-qa.json`에 열거된 실제 앱 52개 PNG도 모두 직접 열었다. 등록, 수령 애니메이션, 네 방향 이동의 start/mid/settled, 책장 앞·뒤 가림, 배치, 재접속, 100권/빈 책장, 독서석, 실패 자랑소, reduced motion, 200% 텍스트 화면에서 신규 시각 회귀를 찾지 못했다. 모든 화면은 1280×800이며 CJK 텍스트 잘림·겹침, 의도치 않은 문서 스크롤 또는 첫 화면 overflow 증거가 없다.

## blockers

없음.

## product/evidence

- 제품 판정: **PASS** — 사용자가 지적한 세 가지 외형 문제가 실제 렌더와 실제 앱 흐름에서 해소됐다.
- 증거 판정: **PASS** — 최종 72개 화면(고정 렌더 20 + 실제 앱 52)을 직접 열어 확인했다.
- 고정 렌더: `.omo/evidence/library-carry-pose/final.json` 및 해당 JSON에 열거된 `final-*.png` 20개.
- 픽셀 확대: `detail-down.png`, `detail-left.png`, `detail-right.png`, `detail-up.png`.
- 실제 앱: `.omo/evidence/library-carry-pose/play-qa.json` 및 해당 JSON에 열거된 PNG 52개.
- 비교 증거: `.omo/evidence/library-carry-pose/before.json`, `before-*-carry-idle.png` 4개.
- 구현: `src/components/student/library/CanvasLibraryRenderer.ts`, `drawBear` 구간. 현재 SHA-256 `d50145985188a14640eb177ffee2da8a5ca8f938c9b3177cbd4297fc7dd44b17`은 `final.json`의 `sourceStart`/`sourceEnd`와 일치한다.
- 자동 결과를 그대로 신뢰하지 않고 픽셀을 직접 확인했으며, 보조 체크 `backBookOccluded`, `unladenPreserved`, `holdingArmsStable`, `scarfTrailsBehind`도 모두 true다. 실제 앱 체크 16개도 모두 true이고 `errors`는 빈 배열이다.

## remove-ai-slops / programming 직접 검토

변경은 기존 `drawBear`의 렌더 순서와 조건을 좁게 조정하며 새 의존성, 범용화된 단일 호출 helper, 불필요한 parser/normalizer, 죽은 코드, 디버그 로그, 방어적 예외 처리 또는 삭제 사실만 확인하는 테스트를 추가하지 않았다. 픽셀 체크는 구현 문장을 고정하거나 삭제 자체를 검증하는 테스트가 아니라 사용자 관찰 결과(책 가림, 팔 안정성, 스카프 방향, 빈손 보존)를 구분한다. 실제 화면 52개는 해당 픽셀 체크와 독립된 제품 흐름 증거다.

`CanvasLibraryRenderer.ts`는 1051 pure LOC로 skill의 크기 기준을 초과하지만, 이는 이번 좁은 사용자 요청의 성공 기준이 아니며 기존 대형 렌더러 전체 분리는 범위 밖이므로 NOTE로만 기록한다. 이번 수정이 새 추상화나 별도 모듈을 늘리지 않아 추가 유지보수 부담은 확인되지 않았다.

## exactEvidenceGaps

- 별도 코드 리뷰 보고서가 이 증거 디렉터리에 없어, 그 보고서가 `remove-ai-slops`/`programming` 관점을 명시적으로 다뤘는지는 확인할 수 없다. 본 독립 검토가 해당 관점과 overfit/slop 기준을 직접 적용했으며, 이는 명시된 사용자 성공 기준 실패로 연결되지 않으므로 blocker가 아니다.
- `omo` 실행 파일이 현재 셸 PATH에 없어 `omo ulw-loop status --json`을 재현하지 못했다. 상위 작업이 지정한 attempt 디렉터리 `.omo/evidence/library-carry-pose/`와 계획 파일을 직접 확인해 본 보고서를 지정 경로에 기록했다.

## checkedArtifactPaths

- `.omo/plans/library-carry-pose.md`
- `.omo/evidence/library-carry-pose/report.md`
- `.omo/evidence/library-carry-pose/before.json`
- `.omo/evidence/library-carry-pose/final.json`
- `.omo/evidence/library-carry-pose/play-qa.json`
- `final.json`에 열거된 PNG 20개 전부
- `play-qa.json`에 열거된 PNG 52개 전부
- `detail-*.png` 4개
- `before-*-carry-idle.png` 4개
- `src/components/student/library/CanvasLibraryRenderer.ts`의 `drawBear` 및 인접 `drawSatchel`/`drawCarriedBook`
