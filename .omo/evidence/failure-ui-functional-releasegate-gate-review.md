# Final Gate Review — failure UI functional release gate

- recommendation: **APPROVE**
- blockers: none
- originalIntent: 최종 narrow-header 수정 이후 실패 자랑소 화면이 지정된 데스크톱/좁은 폭 레이아웃 및 이동·배너 계약을 충족하는지 읽기 전용으로 검증한다.
- desiredOutcome: 1280/1024/1366에서 3열×2행, 640에서 1열 내부 스크롤, 5.25rem 우측 레일과 올바른 이전/다음 의미, 안정적인 ID 기반 톤, 온전한 한국어/CJK, 연습 배너 무충돌 및 좁은 폭 축약.

## User outcome review

PASS. 네 PNG 모두 화면 경계 내에서 헤더·카드·우측 레일·작성 버튼이 잘리지 않고, 카드 본문과 한국어 줄바꿈이 읽을 수 있다. `한 입이라도`가 1280/1024/1366 증거에서 온전히 보인다. 640 증거는 카드가 한 열로 이어지며 피드 자체 스크롤바가 보이고, 헤더의 배너는 시각적으로 `연습 모드`만 표시한다. 배너와 캐치프레이즈/책장 버튼 간 충돌은 없다.

## Checked artifacts

- `.omo/evidence/failure-exhibition-ui-20260829/primary-1280x800.png` — RGB 1280×800, 2026-08-29 00:29:33
- `.omo/evidence/failure-exhibition-ui-20260829/secondary-1024x800.png` — RGB 1024×800, 2026-08-29 00:29:33
- `.omo/evidence/failure-exhibition-ui-20260829/secondary-1366x800.png` — RGB 1366×800, 2026-08-29 00:29:33
- `.omo/evidence/failure-exhibition-ui-20260829/effective-640x800.png` — RGB 640×800, 2026-08-29 00:29:33
- `src/index.css` — source mtime 2026-08-29 00:28:52; 3×2 desktop grid, 1-column narrow grid with `overflow-y:auto`, 5.25rem rail, visually-hidden banner detail span.
- `src/components/student/StudentFailureRelay.tsx` — `이전` calls `move(-1)` and is titled `더 새로운 이야기`; `다음` calls `move(1)` and is titled `더 오래된 이야기`.
- `src/components/student/StudentFailureMessage.tsx` — story ID feeds `getFailureStoryTone`, Korean story/lesson are rendered separately and left aligned by CSS.
- `src/lib/failureExhibition.ts` — deterministic string hash modulo 3 provides stable ID-derived tone; visible count is 6.

## Direct programming / remove-ai-slops pass

- No criterion-breaking type escape hatch, dead navigation target, unnecessary production abstraction, or implementation-mirroring/deletion-only/tautological test was needed to establish this UI outcome.
- Existing large stylesheet/module size and broader test strategy are outside this narrowly stated release criterion and are therefore notes, not blockers.
- The supplied task did not include a separate code-review report or manual QA matrix artifact. Direct source and PNG reproduction supports the stated criterion; this is an evidence gap only for broader process auditing, not a blocker for this scoped gate.

## Exact evidence gaps

- `omo ulw-loop status --json` is unavailable because the `omo` executable is not installed/on PATH, so the required fallback report path is used.
- No interactive click capture was supplied; direction/targets are verified from the rendered controls plus their exact source handlers and titles.

