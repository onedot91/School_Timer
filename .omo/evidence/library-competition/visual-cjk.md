# 전국 책방 챌린지 최종 Visual/CJK Gate

## Verdict

**PASS**

- `[product]` blockers: 없음
- `[evidence]` blockers: 없음

## Original intent / desired outcome

- 1280×800에서 전국 17개 학교 순위를 한 번에 읽고, 우리 학교 행과 `우리 학교` 표식을 즉시 구분할 수 있어야 한다.
- 한국어가 자연스럽고 읽기 쉬우며 tofu, 잘린 조사/음절, 비정상 줄바꿈, 요소 겹침이 없어야 한다.
- 교실 책방의 따뜻한 종이·민트·골드 테마를 유지하고, 하단 좌측 트로피/가구 및 기존 책등·책 운반·배치·열람·실패 자랑소 화면을 훼손하지 않아야 한다.
- 200% 텍스트 확대에서는 문서 전체가 아닌 각 패널의 의도된 내부 스크롤로 모든 내용을 접근할 수 있어야 한다.
- 교사 화면은 16개 상대 학교 권수 입력, 우리 학교 자동 집계 읽기 전용 표시, 확인/저장/충돌/새로고침/일시정지/이력 상태를 명확히 보여야 한다.

## Page coverage and direct image inspection

총 **90/90 PNG를 직접 열어** 원본 렌더링을 검토했다. 파일명이나 JSON의 `passed` 값만으로 판정하지 않았다.

1. `.omo/evidence/library-competition/ui-qa.json`: **32/32**
   - 학생: 입장, 순위 기본/포커스/키보드/클릭, 17개 학교, 우리 학교 강조, 빈 이력, 월 변경/롤오버, 과거 순위/보관 책, 200% 상·하단 내부 스크롤.
   - 기존 책방: 책 등록, 실제 책 운반 start/mid/settled, 자리 선택, 책 배치, 실패 자랑소 회귀.
   - 교사: 기본/유효성 오류/확인/저장/이력/충돌/재로딩/재개/200% 확대.
2. `.omo/evidence/library-competition/regression-qa.json`: **52/52**
   - 책 수령·운반·배치 애니메이션, 100권 실제 책등과 네 책장 전체/하단 선택, 책 상세/독서 코너, 사방 이동 start/mid/settled, 책장 앞·뒤 레이어, 라우트 회귀, 실패 자랑소 작성/도장/빈 상태/200% 확대, reduced-motion 상태를 모두 직접 확인했다.
3. `.omo/evidence/library-competition/state-qa.json`: **6/6**
   - 학생 loading/unavailable/inactive-readonly, 교사 loading/unavailable/inactive를 직접 확인했다.
   - 이 6장은 실제 컴포넌트에 page-realm client만 교체한 **INJECTED FIXTURE**이며 백엔드 통계 증거로 사용하지 않았다. 화면 좌상단 영문 fixture 표시는 증거 하네스 라벨로서 제품 CJK 결함이 아니다.

## User outcome review

- 학생 순위판 기본 화면에서 1–17위가 모두 한 화면에 보이며 `대구광역시 / 대구장동초등학교 / 우리 학교` 행이 민트색과 배지로 분명히 구분된다.
- `순위`, 지역, 학교명, 권수의 한글/숫자 정렬은 안정적이다. `세종특별자치시`, `강원특별자치도`, `제주특별자치도`와 긴 학교명도 겹치거나 잘리지 않는다.
- 200% 순위·과거 기록 화면은 제목, 탭, 선택기, 표 셀이 읽히며 상·하단 캡처가 같은 내부 표 스크롤의 정상 경계를 증명한다. 화면 가장자리에서 일부 행이 사라지는 것은 의도된 내부 스크롤 위치이며 clipping defect가 아니다.
- 교사 기본 화면에는 상대 학교 입력 16개와 우리 학교 `권 · 자동 집계` 출력이 구분된다. `100` 입력도 200% 캡처에서 입력 상자 안에 온전히 들어간다. 확인 패널, 저장 후 이력, 충돌 안내, 일시정지/재개 상태가 서로 겹치지 않는다. 일부 교사 캡처가 중간 스크롤에서 시작하는 것은 활성 컨트롤을 보여 주기 위한 정상 상태다.
- 따뜻한 크림 종이, 민트 강조, 골드 트로피와 픽셀 책방 팔레트가 일관된다. 순위판은 배경 책방을 가리지만 모달 용도에 맞고, 닫힌 상태에서는 하단 좌측 트로피/가구와 책방 동선이 방해받지 않는다.
- 실제 책등, 빈 책장, 100권 채움, 운반 중 책, 자리 선택, 배치 책, 독서 카드와 실패 자랑소는 모두 보존되었다.
- 90장 전체에서 tofu(□/�), 깨진 한글 조합, 의도치 않은 한 글자 줄바꿈, 버튼/숫자/배지 겹침, 검은 합성 영역은 발견하지 못했다.

## Source and freshness evidence

- Git HEAD: `06d774beeb6e75f717fa0ad94788fa3540c0c117`
- `LibraryCompetitionPanel.tsx`: `63bb3661931e5a458beaeac5c68954485148355259fa2f8d2dccc5f23974ce60`
- `LibraryCompetitionTable.tsx`: `bc24bbe17f15c24a7a1b0d624c5b82a0e8ee46350f72cb1747cdddf2e7f02922`
- `TeacherLibraryCompetitionPanel.tsx`: `29ca8db43c577780f6055b39884632f0683400e042236e0fb98b3bd276668f8e`
- `src/index.css`: `a49dae4977234fe0d94d05c1cd758788cc0eb2038367e84b07fd737093acf3da`
- `ui-qa.json`의 `sourceStart`와 `sourceEnd`가 동일하며 위 네 파일의 현재 SHA-256과 일치한다.
- `regression-qa.json`의 `sourceSha256`는 기존 책방/실패 자랑소 관련 현재 소스와 일치하고 `passed: true`다.
- `state-qa.json`의 `sourceHashesEqual: true`, `errors: []`; 위 네 파일을 포함한 `sourceStart`/`sourceEnd`가 현재 해시와 일치한다.
- 세 QA 기록 모두 1280×800 PNG를 열거하며, 브라우저 오류는 0건으로 기록되어 있다.

## Direct slop / programming review

- 관련 세 TSX 컴포넌트와 경쟁 UI CSS를 직접 읽었다. UI는 실제 DOM table/form/input/output/details 구조이며 캡처 이미지를 제품 UI로 붙인 구현이 아니다.
- `--competition-*` 토큰과 공통 클래스가 학생/교사 화면을 함께 구동한다. 한 화면 전용 raster fake나 통계 하드코딩을 찾지 못했다.
- 테스트/증거에는 삭제만 검증하는 테스트, 요청 문구만 고정하는 tautology, 구현을 그대로 복제한 시각 통과 조건이 보이지 않았다. PNG fixture는 상태 주입임을 명시하며 백엔드 동작 증거로 과장하지 않는다.
- CSS 추가량과 기존 대형 `src/index.css`는 유지보수 NOTE이나, 이번 visual/CJK 성공 기준을 위반한다는 증거는 아니므로 blocker가 아니다.

## Evidence gaps / notes

- 정확한 pixel-reference leaderboard는 사용자 승인 계획상 요구되지 않았다. 따라서 기준은 최신 기능·시각 의도이며 임의의 픽셀 유사도 점수를 만들지 않았다.
- SQL 운영 엔진 검증은 이 visual/CJK gate의 범위 밖이다.
- 실제 네트워크 장애와 비활성 상태의 여섯 화면은 fixture 기반 화면 증거이므로, 운영 백엔드 가용성이나 실제 학교 통계를 증명하지 않는다.

## Recommendation

**APPROVE / PASS** — 현재 90개 화면 증거와 동결된 소스에서 명시된 visual/CJK 성공 기준을 위반하는 결함을 찾지 못했다.
