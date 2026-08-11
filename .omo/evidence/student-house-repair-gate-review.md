# Student House Repair Gate Review

- recommendation: APPROVE
- blockers: []
- originalIntent: 학생별 집 수리 상품을 정확히 100 고마에 1회만 구매하게 하고, 예약 고마를 침범하지 않으며 Supabase/localStorage 양쪽에서 상태를 보존하고, 집 그림이 기존 우편함·책방·펫 조작을 막지 않게 한다.
- desiredOutcome: 학생마다 독립적인 수리 상태가 저장되고 구매 전후 집 그림이 바뀌며, 중복 구매 및 사용 가능 잔액 부족 구매가 거부되고 기존 화면 컨트롤이 포인터·키보드로 계속 동작한다.

## User Outcome Review

APPROVE. `house_repair` 가격은 100으로 고정되어 있고, 공통 `spend` 경로가 `availableWallet`을 검사한 뒤 실제 지갑에서 차감한다. 상태는 `studentEconomy[studentKey]`로 읽고 쓰므로 학생별이며, `inventory.house_repair > 0`이면 재구매를 거부한다. Supabase 경로는 최신 공유 설정을 정규화한 뒤 학생 키만 갱신하고, fallback 경로는 동일 상태를 localStorage snapshot에 저장한다. 집 이미지는 장식 이미지(`alt=""`, `aria-hidden`, `pointer-events:none`)이며, 우편함·책방·펫은 독립된 버튼과 접근 가능한 이름/포커스 표시를 유지한다. 데스크톱·768px·375px 증거에서 수리 후 그림 렌더링을 확인했다.

## Criteria Evidence

- C1 per-student: `src/pages/AuctionPage.tsx:1245-1278`, `1282-1307`, `1348-1349`; `studentKey`별 economy state 및 balance를 읽고 병합한다.
- C2 exact cost 100: `src/lib/studentEconomy.ts:6-11`, `176-185`; 테스트 `src/lib/studentEconomy.test.ts:31-47`에서 145 → 45를 재현한다.
- C3 one-time: `src/lib/studentEconomy.ts:179-180`; 테스트에서 두 번째 request가 `HOUSE_ALREADY_REPAIRED`로 실패한다.
- C4 balance/reserved validation: `src/lib/studentEconomy.ts:149-152`, `182`; Supabase는 최신 bids 기반 reserve를 재계산(`src/pages/AuctionPage.tsx:1246-1261`), fallback은 현재 `reservedAmount`를 제외(`1282-1289`)한다.
- C5 Supabase/localStorage fallback: `src/pages/AuctionPage.tsx:1238-1307`; local snapshot 정규화/저장 `src/lib/studentPet.ts:378-410`.
- C6 controls unobstructed/accessibility: `src/components/student/StudentPetStage.tsx:102-124`; `src/index.css:12040-12057`, `16116-16134`. 집 art는 포인터 이벤트를 받지 않고, controls는 44px 최소 크기·focus-visible 표시·aria-label을 갖는다.

## Verification Reproduced

- `npm test -- --run`: 63 passed, 0 failed.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm run build`: passed; 기존 Vite chunk-size warning 1건.
- Visual evidence inspected: before/after desktop, after 768px, after 375px, shop screenshot.

## Slop / Programming Review

- Direct overfit/slop pass: house test asserts observable wallet and inventory outcomes plus duplicate rejection; it is not deletion-only, tautological, or implementation-mirroring. No house-specific unnecessary parser/extraction/normalization was introduced.
- Notes only: the house test does not separately instantiate two student keys or directly test a reserved-balance house purchase; those behaviors are nevertheless directly established by the keyed persistence code and shared `spend(availableWallet)` path. No stated criterion is failed.
- Maintenance note: duplicate `.student-character-stage-card` background declarations and pre-existing/expanded oversized page modules are slop/maintenance concerns, but do not violate this gate's stated success criteria.
- Code review report / manual QA matrix / notepad: no such files were present in `.omo/evidence/student-house-repair/`; direct artifact review and reproduced checks provide completion evidence.

## Checked Artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentPet.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentShopPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-house-repair/overview-before.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-house-repair/overview-after.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-house-repair/overview-after-768.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-house-repair/overview-after-375.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-house-repair/shop-before.png`

## Exact Evidence Gaps

- Missing: dedicated code-review report with explicit programming/remove-ai-slops coverage.
- Missing: manual QA matrix and notepad path.
- Missing: focused automated test for two distinct student keys and focused house-purchase rejection when wallet is sufficient but available wallet after reservation is below 100.
- These are evidence-quality gaps, not blockers, because the stated criteria are directly supported by inspected production paths, existing behavioral tests, and rendered evidence.
