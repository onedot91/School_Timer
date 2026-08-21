# Bookshelf bounded visual gate review

- recommendation: APPROVE
- blockers: []
- originalIntent: 책의 쪽수 차이가 실제 책등 두께 차이로 확실히 보이고, 참고 이미지처럼 중심이 안정된 자연스러운 책탑을 만들되 과도한 쪽수는 화면을 덮지 않도록 한다.
- desiredOutcome: 15/30/37/45쪽 책이 각각 27/36/40.2/45px 두께로 렌더링되고, 5000쪽도 45px을 넘지 않으며, 1024/1280/1366px 화면에서 책들이 잘리거나 부자연스럽게 흩어지지 않는다.

## User outcome review

APPROVE. 현재 상대 비율 함수는 화면에 표시되는 책들의 최소·최대 쪽수를 27–45px 범위로 선형 매핑한다. 사용자 데이터 15/30/37/45쪽은 코드와 회귀 테스트에서 27/36/40.2/45px로 고정되어 두께가 동일해 보이던 문제가 해소되었다. 5000쪽은 허용 입력의 최댓값이며 `[15, 5000]` 범위에서도 45px 상한으로 제한된다. 12개 폭/오프셋 패턴은 폭 81–92%, 중심 이동 -1–1%로 제한되어 참고 이미지의 손으로 쌓은 변화를 남기면서 과도한 지그재그를 제거한다.

1024×768, 1280×800, 1366×768 캡처에서 네 책의 두께 차이가 식별되고, 책등 텍스트와 선반이 잘리지 않으며, 책탑 중심축이 안정적이다. 세 화면 모두 콘텐츠 경계 안에 머물고 제목·글쓴이·쪽수 간 겹침이 없다.

## Criteria

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| SC-1: 15/30/37/45쪽이 27/36/40.2/45px로 구분됨 | PASS | `src/lib/studentLife.ts:44-45,163-170`; `src/lib/studentLife.test.ts:19-27`; targeted test 8/8 pass |
| SC-2: 5000쪽도 45px 상한 | PASS | `src/lib/studentLife.ts:168-170`; `src/lib/studentLife.test.ts:34`; targeted test pass |
| SC-3: 배치가 자연스럽고 잘림 없음 | PASS | `src/lib/studentLife.ts:46-58,173-175`; `src/components/student/StudentLibraryPage.tsx:60-77`; three visual artifacts below |

## Checked artifacts

- User current screenshot: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-eb0761b0-59eb-46fa-b68b-75def4f8acb3.png`
- User reference screenshot: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-16ba5156-3f8f-43ce-a368-8ce1332f7f16.png`
- `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1024.png`
- `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1280.png`
- `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1366.png`
- `src/lib/studentLife.ts`
- `src/lib/studentLife.test.ts`
- `src/components/student/StudentLibraryPage.tsx`
- `src/index.css`
- `DESIGN.md`

## Direct programming and remove-ai-slops pass

- The change fixes the shared calculation seam once; the component consumes the helper directly.
- No new dependency, type suppression, debug code, speculative abstraction, parsing layer, or redundant production normalization was introduced for this behavior.
- The regression assertions exercise observable numeric contracts and layout bounds. They are not deletion-only, tautological, implementation-mirroring, prose-pinning, or snapshot tests.
- NOTE: the thickness test covers several related numeric cases in one test, but this does not violate any stated success criterion and the assertions independently detect the reported regression.

## Exact evidence gaps

- None for the stated criteria.
- The `omo` CLI was unavailable (`command not found`), so the mandated fallback report path under `.omo/evidence/` was used.

