# 전국 책방 챌린지 — 최종 시각·기능 무결성 리뷰

- recommendation: **PASS**
- blockers: **없음**
- review date: 2026-09-05
- mode: read-only production/source review. 이 보고서 외 production 변경, backend 호출, DB mutation 없음.

## Original intent

제공된 17개 학교명을 사용하는 월별 책방 챌린지(우리 학교 실제 기록, 상대 16곳은 게임 생성 기록)를 기존 Canvas 도서관에 통합한다. 우리 학교 점수는 실제로 서가에 꽂힌 책만 0..100권으로 집계하고, seeded rival은 수업 시간·지연·일일 수동 성장·cap·일시정지/속도 규칙을 따른다. 학생은 왼쪽 아래 트로피에서 E/ㄷ/Enter/근접 클릭으로만 순위판을 열며, 1280×800 첫 화면에서 17행을 읽고 200% 확대에서는 문서가 아닌 내부 영역을 스크롤한다. 교사는 경쟁 학교 점수·속도·일시정지를 확인 후 저장하고 충돌을 복구할 수 있어야 한다. 월 변경 시 지난 순위와 책을 보관하며, UI는 기존 교실 종이/초록 토큰과 접근성·focus/Escape 계약을 지키고 raster로 위장한 UI를 쓰지 않는다.

## Desired outcome / user outcome review

**충족.** 학생 도서관의 왼쪽 아래 독립 트로피 보드, 근접 cue, 17행 순위표, 우리 학교 비색상 표지, 지난달 기록/책 목록, 교사 설정·확인·충돌·재로드 상태가 실제 React/Canvas 구현으로 연결되어 있다. 90개의 서로 다른 최신 1280×800 PNG를 직접 contact-sheet 및 주요 원본으로 검토했고 clipping, overlap, 첫 화면 문서 스크롤, CJK 파손, fake raster UI를 찾지 못했다. 200% 상태는 `window/body/root scrollY=0`, 순위표 내부 스크롤 및 고정 header/닫기 버튼을 기록한다. loading/unavailable/inactive 상태도 실제 두 패널에 page-realm client만 주입한 별도 캡처로 확인됐다.

## Criteria review

- [product] **PASS — 17 schools / real own count / 0..100.** `libraryCompetitionTypes.ts`에 17개 학교와 단일 `school-03`이 고정되고, projection은 우리 학교를 placement event만으로 계산한다. codec은 경쟁 학교 수동값만 정수 0..100으로 받고 우리 학교 override를 거부한다. 교사 UI도 우리 학교는 `<output>`이며 16개 상대 학교만 input이다.
- [product] **PASS — seeded business-hour behavior.** profile은 4 relaxed/8 middle/4 leader이고, 이벤트는 weekday 08:00–16:00 KST business-minute 지연, placement reaction, passive opportunity, 1시간 간격, own-count 기반 cap, speed/pause를 적용한다. 직접 재실행한 84개 경쟁 테스트가 모두 통과했다.
- [product] **PASS — monthly archive and controls.** local/server source와 atomic review는 마지막 active month 1회 archive, placed books 보관, unplaced/reward 보존, rollover 시 speed/pause 유지와 과거 manual count 미승계를 확인한다. 교사 UI는 revision 기반 확인 저장, invalid/confirm/saved/conflict/reloaded/resumed/history 상태를 제공한다.
- [product] **PASS — trophy interaction contract.** board는 room 좌하단 `x:52,y:244`에 별도 fixture/collider로 존재한다. 키 처리는 `e`, `ㄷ`, physical `KeyE`, `enter`만 interaction으로 보내고, pointer는 근접 target이면서 board visualRect 안인 경우만 연다. cue는 근접 시에만 DOM button으로 표시되고 `kbd E`를 제공한다.
- [product] **PASS — responsive/accessibility.** dialog는 `aria-modal`, labelled title, busy/status, focus trap, Escape dismiss와 canvas focus return을 사용한다. table은 focusable named region, semantic table headers와 `aria-current` own row를 갖는다. 1280×800의 17행, 200% 내부 스크롤, 44px controls, reduced motion 및 focus-visible 상태가 캡처/소스에 일치한다.
- [product] **PASS — theme/originality.** competition UI는 cream/green/mint/gold/ink 토큰과 실제 DOM table/form을 사용하고 Canvas 보드도 renderer primitive로 그린다. 공식 통계 주장이나 virtual-data label은 없다.
- [evidence] **PASS — capture packet.** `ui-qa.json` 32개 + `regression-qa.json` 52개 + `state-qa.json` 6개 = 90개, unique 90개. Sharp metadata 재검사 결과 전부 PNG 1280×800이며 bad 0. 세 receipt 모두 errors 0이고 source identity가 현재 파일과 일치한다.
- [evidence] **PASS — executable verification.** `node --import tsx --test tests/api/libraryCompetition.test.ts src/lib/libraryCompetition*.test.ts`: 84/84 pass, fail 0. `npm run lint` (`tsc --noEmit`): exit 0.

## Direct remove-ai-slops / programming pass

Production과 tests를 직접 검토했다. 제거만 검증하는 test, tautological expected-from-output test, snapshot/prose pin, fake-only production branch, 불필요한 parser/normalizer extraction, dead debug logging은 발견하지 못했다. boundary codec/transport/local archive normalization은 persisted/API unknown 입력과 destructive rollover 보호에 쓰이므로 필요하다. `libraryCompetitionWiring.test.ts`의 source-regex 3개는 구현 결합형이라 유지보수 NOTE지만, 실제 API/integration/domain 및 90개 UI evidence가 별도로 행동을 검증하므로 성공 기준 blocker가 아니다. `TimerPage.tsx`와 `index.css`는 250 pure LOC를 크게 넘는 기존 대형 파일이며 이번 통합이 일부 추가되었으나, 이것은 이번 명시적 사용자 결과의 실패를 입증하지 않아 NOTE로만 기록한다.

## Checked artifacts

- `.omo/evidence/library-competition/ui-qa.json` 및 열거된 32 PNG
- `.omo/evidence/library-competition/regression-qa.json` 및 열거된 52 PNG
- `.omo/evidence/library-competition/state-qa.json` 및 열거된 6 PNG
- `.omo/evidence/library-competition/atomic-review.md`
- `src/lib/libraryCompetition*.ts`, `src/lib/canvasLibraryWorld.ts`, `src/lib/canvasLibraryPlacement.ts`, `src/lib/canvasLibraryClient.ts`
- `src/components/student/library/{CanvasLibraryCompetitionBoard,CanvasLibraryGame,CanvasLibraryRenderer,LibraryCompetitionPanel,LibraryCompetitionTable}.*`
- `src/components/student/StudentLibraryPage.tsx`, `src/components/teacher/TeacherLibraryCompetitionPanel.tsx`
- `src/pages/AuctionPage.tsx`, `src/pages/TimerPage.tsx`, `src/index.css`

## Current source hashes (SHA-256)

| Source | SHA-256 |
| --- | --- |
| `src/lib/canvasLibraryWorld.ts` | `e57b8def7eb4e6d3c2d277bfe4057a5f484247da6edba70e73f0cddda58b9c62` |
| `src/lib/canvasLibraryClient.ts` | `9e65e7b63d581f823d89214fc06c47a4cbb48ece1c897b20c5198124fbc884ba` |
| `src/lib/canvasLibraryPlacement.ts` | `1c67b24fe8fdd0e05e111c095b609ab597b0ecbe931efd59b63b81862ccf6fa9` |
| `src/lib/libraryCompetition.ts` | `5afcd7ea122c29147a8d9615da88e4c5f8cdf408ea043c9bd551d52c5176aadc` |
| `src/lib/libraryCompetitionCodec.ts` | `66a728f875d59cad7741d00f18dd4b929ce007e00995df946cdeffb1183ffd91` |
| `src/lib/libraryCompetitionEvents.ts` | `cf53d78edb7b2f833e47f78e67ced3694bec0ed8a81711f9da01c479b4b6e8f6` |
| `src/lib/libraryCompetitionLocalArchive.ts` | `9ccd2d20a7e1a5ccaf2e468d052558d24adda5c644060ebecbc22be4323bb680` |
| `src/lib/libraryCompetitionLocalSnapshot.ts` | `650561a61222912eb4f214e00c5c7ed60d34b499ed4b501c09234ccc2c33b6ed` |
| `src/lib/libraryCompetitionLocalStore.ts` | `c0a44530530bd67bbeb5bdf877debcde1fae7615aea534d5fad957362fd8a4d1` |
| `src/lib/libraryCompetitionProfiles.ts` | `19d86c1ce92caf3b1cac77242a3cdff3d69c338e70e0430c67b9740b39512795` |
| `src/lib/libraryCompetitionProjection.ts` | `b29ee9f26c56395137f754c56d043631a07b79425e1d33b5222366b814b216ef` |
| `src/lib/libraryCompetitionResponse.ts` | `5f7bb248e07d58268fba79dd34ed553671ee06e8fa528aa5c7d071bbe5f43393` |
| `src/lib/libraryCompetitionTime.ts` | `b0589e939e2eadecc068e022de25f9e1dd1de2f63bf127fa2af705a6f8ca6722` |
| `src/lib/libraryCompetitionTransport.ts` | `6ff6c75f982c315ddd9f28bf9b9edeef90d8dcb00cc53959f60bc592d97b2399` |
| `src/lib/libraryCompetitionTypes.ts` | `a708f3619c83a3a7d6a3c51b62c3fb25b7450c8e4b35969aa25adbccf67c2ad3` |
| `src/components/student/StudentLibraryPage.tsx` | `2c389aafd9d3d8adaeb3018b1b97dcf2151c359c6f0c68a44fa47e0d57978f78` |
| `src/components/student/library/CanvasLibraryGame.tsx` | `5a33bf38ac83ddcfe94d122e4b9579eb5be1a29d9b819d1e7310e4c557db0cdd` |
| `src/components/student/library/CanvasLibraryRenderer.ts` | `b70fa465418af1f74700dad65c77cc83a816cc80e1007df4ab6395ea5a055a0c` |
| `src/components/student/library/CanvasLibraryCompetitionBoard.ts` | `440e71db3f5d64c52881dca54c7112c5d198ae4c0009f665871a410da9b846bd` |
| `src/components/student/library/LibraryCompetitionPanel.tsx` | `63bb3661931e5a458beaeac5c68954485148355259fa2f8d2dccc5f23974ce60` |
| `src/components/student/library/LibraryCompetitionTable.tsx` | `bc24bbe17f15c24a7a1b0d624c5b82a0e8ee46350f72cb1747cdddf2e7f02922` |
| `src/components/teacher/TeacherLibraryCompetitionPanel.tsx` | `29ca8db43c577780f6055b39884632f0683400e042236e0fb98b3bd276668f8e` |
| `src/pages/AuctionPage.tsx` | `aaabca53448d123cfca925336e39a3bfa9f47b36b4c5fe2b436e59fd3d73865c` |
| `src/pages/TimerPage.tsx` | `6dcd1772afb94faf1d0d7a07c8cdcda33f923a7318c740bc14aeac5efdb27be9` |
| `src/index.css` | `a49dae4977234fe0d94d05c1cd758788cc0eb2038367e84b07fd737093acf3da` |

## Exact evidence gaps / notes

- PostgreSQL engine은 실행하지 않았다. PL/pgSQL, lock, trigger privilege, transaction rollback의 실제 엔진 검증 및 production 적용은 이 PASS의 범위가 아니다. `atomic-review.md`도 이를 명시한다.
- `state-qa`는 실제 panel source를 렌더했지만 page realm에서 client singleton을 주입했다. 따라서 loading/unavailable/inactive UI·focus 증거이지 backend/SQL 증거가 아니다.
- `omo ulw-loop status --json`은 현재 환경에서 `omo: command not found`였으므로, 요청된 명시적 evidence 경로인 `.omo/evidence/library-competition/visual-integrity.md`를 사용했다.
