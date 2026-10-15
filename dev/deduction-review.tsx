import { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import StudentOverviewPage from '../src/components/student/StudentOverviewPage';
import { applyTeacherCurrencyDeductionsInSettings, normalizeCurrencyBalances, settlePendingTeacherDeductionsInSettings } from '../src/lib/currency';
import { getStudentEconomyState, normalizeStudentEconomyStates } from '../src/lib/studentEconomy';
import { getStudentPetState, storeStudentPetSnapshot } from '../src/lib/studentPet';
import { normalizeStudentLifeState } from '../src/lib/studentLife';
import { normalizeCurrencyHistory } from '../src/lib/currency';
import { appDataMode } from '../src/lib/dataMode';
import '../src/index.css';

const fixture = (): Record<string, unknown> => applyTeacherCurrencyDeductionsInSettings({
  currencyBalances: { '14': 2 }, currencyHistory: { '14': [] }, studentEconomy: {}, studentLife: { letters: [] },
}, { studentNumbers: [14], amount: 10, teacherReason: '크롬북 안 넣어두고 감', requestId: 'mock-chromebook',
  createdAt: new Date().toISOString(), deferIfInsufficient: true }).value;
const accept = async () => true;
const noop = () => {};
const TeacherPreview = lazy(() => import('../src/pages/TimerPage'));

function Review() {
  const [value, setValue] = useState(fixture);
  const balance = normalizeCurrencyBalances(value.currencyBalances)['14'];
  const reservedAmount = new URLSearchParams(location.search).get('reserved') === '1' ? Math.min(1, balance) : 0;
  const economy = getStudentEconomyState(normalizeStudentEconomyStates(value.studentEconomy), 14);
  const reward = (amount: number) => setValue(current => settlePendingTeacherDeductionsInSettings({
    ...current, currencyBalances: { '14': normalizeCurrencyBalances(current.currencyBalances)['14'] + amount },
  }));
  return <div className="auction-page student-mode-page custom-scrollbar h-[100dvh] w-full overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 md:py-5">
    <main className="mx-auto w-full max-w-7xl">
      <StudentOverviewPage studentNumber={14} profileAssignments={{}} balance={balance} availableBalance={balance - reservedAmount} reservedAmount={reservedAmount}
        isLoading={false} pendingDeductions={economy.pendingDeductions} pet={getStudentPetState({}, 14)} isPetSaving={false} todayEmotion={null} hasUnreadMail={false}
        isHouseRepaired={false} ownedCharacterIds={[]} activeCharacterId={null} isCharacterSaving={false}
        ownedHouseIds={[]} activeHouseId={null} customHouseDesign={null} isHouseSaving={false}
        onFeedPet={accept} onNamePet={accept} onChangePet={accept} onMovePet={accept} onMoveGoma={accept}
        onSelectCharacter={accept} onSelectHouse={accept} onOpenEmotions={noop} onOpenMissions={noop} onOpenStore={noop}
        onOpenProfileShop={noop} onOpenMailbox={noop} onOpenLibrary={noop} />
    </main>
    <aside className="deduction-review-controls" aria-label="가짜 데이터 테스트">
      <strong>차감 대기 · 가짜 데이터</strong>
      <div><button type="button" onClick={() => reward(5)}>5고마 지급</button><button type="button" onClick={() => reward(10)}>10고마 지급</button><button type="button" onClick={() => setValue(fixture())}>초기화</button></div>
      <output>보유 {balance}고마 · 대기 {economy.pendingDeductions.reduce((sum, item) => sum + item.amount, 0)}고마 · 차감 기록 {(normalizeCurrencyHistory(value.currencyHistory)['14'] ?? []).length}건 · 편지 {normalizeStudentLifeState(value.studentLife).letters.length}건</output>
    </aside>
  </div>;
}

const root = document.getElementById('root');
if (root && import.meta.env.DEV && appDataMode === 'mock') {
  const reviewRoot = createRoot(root);
  if (new URLSearchParams(location.search).get('teacher') === '1') {
    const value = fixture();
    storeStudentPetSnapshot({ studentPets: {}, currencyBalances: normalizeCurrencyBalances(value.currencyBalances), currencyHistory: normalizeCurrencyHistory(value.currencyHistory),
      studentEconomy: normalizeStudentEconomyStates(value.studentEconomy), studentLife: normalizeStudentLifeState(value.studentLife),
      auctionItems: [], auctionBids: {}, auctionBidHistory: {}, auctionAwards: {},
    });
    reviewRoot.render(<Suspense fallback={<p>교사 테스트 화면 불러오는 중</p>}><TeacherPreview /></Suspense>);
  } else reviewRoot.render(<Review />);
  import.meta.hot?.dispose(() => reviewRoot.unmount());
}
