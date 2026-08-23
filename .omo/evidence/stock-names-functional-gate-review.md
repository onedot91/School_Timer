# Stock names functional gate review

- recommendation: APPROVE
- blockers: none
- originalIntent: 증권사 종목 네 개의 표시명을 `냠냠푸드`, `팡팡게임즈`, `척척테크`, `반짝엔터`로 교체한다.
- desiredOutcome: 학생 증권 카드와 거래 UI, 보유 투자 UI, 교사 증권 설정이 동일한 네 이름을 사용하며 기존 저장된 투자·시장 데이터는 계속 연결된다.
- userOutcomeReview: `STUDENT_STOCKS`의 이름이 요청 순서대로 교체되었고, 모든 확인된 소비 화면은 해당 상수 또는 여기서 생성한 quote를 사용한다. 기존 저장 키 `sunny`, `sprout`, `cloud`, `star`와 `basePrice` 15/25/35/20은 유지되어 기존 투자 및 시장 데이터의 키 호환성이 보존된다. 업종에 맞춘 아이콘 변경도 `StudentStockId` 전수 매핑으로 타입 검사된다.

## Checked artifacts

- `src/lib/studentEconomy.ts:159-167`
- `src/components/student/StudentStockTrend.tsx:1-14`
- `src/components/student/StudentStockMarketPage.tsx:45-64`
- `src/components/student/StudentInvestmentActionPanel.tsx:52-57,103-125`
- `src/components/student/StudentSecuritiesPage.tsx:15-33`
- `src/pages/TimerPage.tsx:8969-8995`
- `src/lib/studentEconomy.test.ts:57-70`
- `DESIGN.md:279`
- `git diff` for the four declared changed files

## Reproduced evidence

- Targeted `studentEconomy.test.ts`: 31 passed, 0 failed.
- `npm run lint` (`tsc --noEmit`): passed.
- `git diff --check` for declared changed files: passed.
- Repository search: no legacy names `햇살문구`, `새싹식품`, `구름운수`, `별빛미디어` remain in `src` or `DESIGN.md`.

## Skill-perspective review

- programming: no new type escape hatch, mutable export, public API break, or duplicated stock-name source was introduced. `STUDENT_STOCKS` remains `as const`; icon mapping is exhaustive through `Record<StudentStockId, LucideIcon>`.
- remove-ai-slops: the change adds no helper, abstraction, defensive branch, debug code, or production normalization. The exact-name assertion protects a machine-consumed catalog value rather than prose. No deletion-only or tautological test was added.
- Note: `src/lib/studentEconomy.ts` (920 pure LOC) and `src/lib/studentEconomy.test.ts` (504 pure LOC) are pre-existing oversized files. This task only edits existing constant rows and adds one narrow catalog assertion; splitting them would be unrequested scope expansion and is not a failure of the stated criterion.

## Evidence gaps

- No blocker. The test does not separately assert the full `(id, basePrice)` tuple, but the reviewed diff proves those fields were unchanged and existing investment tests exercise the `sunny` key path. This is a non-blocking coverage note, not a failed criterion.
