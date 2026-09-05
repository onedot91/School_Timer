# Library interior redesign — final gate review

- recommendation: APPROVE
- blockers: []

## originalIntent

밝고 키치하지만 하나의 디자인 시스템으로 읽히는 Canvas 도서관을 만든다. 네 가지로 변주된 책장에 stable slot ID `0..99`를 유지하고, 입구 등록 데스크, 벽 부착 실패 자랑소, 꽃병과 빈백이 있는 독서 코너를 실제 동선과 기능 흐름에 통합한다. 실패 자랑소의 일반/빈 상태/작성기 스타일도 도서관과 일치해야 한다. 최신 추가 기준은 입구 러그가 등록 데스크와 겹치지 않는 것이다.

## desiredOutcome

1280×800 학생 화면에서 등록 → 책 운반 → 실패 자랑소 열기/도장/작성/취소/생성 → 책장 99번 배치 → 새로고침 후 보존이 실제 키보드 흐름으로 동작하고, 4개 책장 100개 자리와 독서 코너가 충돌·클리핑 없이 보인다. 실패 자랑소는 legacy route에서도 도서관 벽보드 스타일로 열리고 200% 텍스트에서도 외부 문서 스크롤 없이 닫기와 내부 탐색이 가능해야 한다.

## userOutcomeReview

APPROVE. `qa.json`에 열거된 28개 fresh 1280×800 캡처를 전부 직접 확인했다. 방은 cream/mint/apricot 기반에 coral/sky/lavender 포인트를 일관되게 사용하며, 네 책장은 높이·행/열·실루엣이 실제로 구분된다. `full-100.png` 및 8개 picker 캡처는 slot `1..100`의 연속성과 각 책장 변주를 보여 준다. 독서 코너에는 테이블 위 꽃병과 별도 빈백이 보이며 이동 캐릭터와 겹치지 않는다. 일반/빈/작성/도장 상태의 실패 자랑소가 동일한 각진 목재·종이·파스텔 토큰 체계를 사용한다.

최신 러그 기준은 소스와 화면 양쪽에서 충족한다. `CanvasLibraryRenderer.ts`의 full-room `drawEntryRug`는 `y = walkableBounds.y + walkableBounds.height - 20 = 338`, 높이 `20`이고, `canvasLibraryWorld.ts`의 데스크 시각/발 충돌 하단은 모두 `326`이다. 따라서 12 logical px 간격이 있다. `entered.png`, `empty-room.png`, `full-100.png`에서 이 바닥 띠가 실제로 보이며 러그가 데스크를 침범하지 않는다.

실제 브라우저 QA 스크립트는 외부/API 요청을 차단한 isolated localStorage fixture로 등록, one-modal owner, 이동 잠금, 도장 Escape, 작성 취소/생성, carry 유지, 99번 배치, 기존 ID/slot 0 보존, reload 상세 보기, 각 picker의 44px 이상 target, reading-nook route, legacy embedded board, 200% 내부 스크롤 및 고정 header/close를 단언한다. `qa.json`의 13개 source SHA-256은 현재 파일을 직접 재계산한 값과 모두 일치한다.

## direct remove-ai-slops / programming pass

변경 생산 코드와 QA를 직접 점검했다. 캡처 수나 제거 사실만 확인하는 deletion-only/tautological 테스트가 아니라 저장 상태, focus, modal count, stable IDs, geometry, target size 및 reload 결과를 관찰한다. 이미지 fake/스크린샷을 제품에 삽입한 흔적은 없고 Canvas2D deterministic drawing과 DOM dialogs를 사용한다. QA가 구현 내부를 그대로 재계산하는 부분은 동선 탐색 보조뿐이며, 성공 판정은 실제 UI와 저장 결과다. 새 helper/normalizer가 최신 러그 수정만을 위해 추가되지 않았고, 러그 수정은 기존 renderer 함수의 full-room 분기 내 최소 geometry 변경이다. 프로젝트 기존 대형 파일은 maintenance NOTE이나, 명시된 성공 기준 실패는 아니다.

## checkedArtifacts

- `.omo/evidence/library-interior-redesign/qa.json`
- `.omo/evidence/library-interior-redesign/qa.mjs`
- `.omo/evidence/library-interior-redesign/tests.log` — 579/579 pass
- `.omo/evidence/library-interior-redesign/lint.log` — `tsc --noEmit` exit 0
- `.omo/evidence/library-interior-redesign/build.log` — Vite build success
- `.omo/evidence/library-interior-redesign/diff.json`
- `.omo/evidence/library-interior-redesign/world-art.md` — stale renderer receipt explicitly superseded by current `qa.json` hashes
- all 28 PNG paths listed in `qa.json`, directly viewed
- current 13 production source files listed by `qa.mjs`, hashes independently recomputed
- `src/components/student/library/CanvasLibraryRenderer.ts`
- `src/components/student/library/CanvasLibraryGame.tsx`
- `src/lib/canvasLibraryWorld.ts`
- `src/lib/canvasLibraryPlacement.ts`
- `src/components/student/StudentLibraryPage.tsx`
- `src/components/student/StudentFailureExhibitionPage.tsx`
- `src/components/student/StudentFailureMessage.tsx`
- `src/index.css`

## evidenceGaps

- `omo ulw-loop status --json` is unavailable in this shell (`omo: command not found`), and no `.omo/evidence/ulw` attempt directory exists; report therefore uses the required non-loop fallback path.
- No separate current code-review report for this final tiny rug fix was found. This is not a blocker because the direct gate pass covers the diff, production code, test quality, and remove-ai-slops/programming criteria, while the exact current hashes and fresh browser evidence verify the shipped state.
- The 200% captures intentionally show internal board-pane cropping while keeping the fixed board header and close control visible; `qa.json.zoomScroll` proves only the inner pane scrolls. This matches the stated accessibility outcome and is not document overflow.

## notes

- `diff.json` is a redesign delta receipt, not a clone-similarity target; its near-total difference from the old baseline is consistent with the requested full interior redesign.
- The repository has unrelated dirty/pre-existing changes. This read-only review did not attribute or modify them.
