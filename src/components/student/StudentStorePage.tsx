import { useState, type ReactNode, type RefObject } from 'react';
import { getKoreanDateKey, type StudentEconomyAction, type StudentEconomyState, type StudentStockId, type StudentStockMarket } from '../../lib/studentEconomy';
import StudentBankPage from './StudentBankPage';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentDonationPage from './StudentDonationPage';
import StudentHeader from './StudentHeader';
import StudentInvestmentActionPanel from './StudentInvestmentActionPanel';
import StudentPlaza, { type StudentStoreSection } from './StudentPlaza';
import StudentShopPage from './StudentShopPage';
import StudentStockMarketPage from './StudentStockMarketPage';
import type { FailureProfileAssignments } from '../../lib/failureExhibition';
import type { StudentProfilePurchase, StudentProfilePurchaseOutcome } from '../../lib/studentProfilePurchase';

interface StudentStorePageProps {
  studentNumber: number;
  profileAssignments: FailureProfileAssignments;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  section: StudentStoreSection;
  children?: ReactNode;
  economyState: StudentEconomyState;
  stockMarket: StudentStockMarket;
  isEconomySaving: boolean;
  donation: {
    totalAmount: number;
    targetAmount: number;
    canDonate: boolean;
    isCompleted: boolean;
    triggerRef: RefObject<HTMLButtonElement | null>;
    onDonate: () => void;
  };
  onEconomyAction: (action: StudentEconomyAction) => Promise<boolean>;
  onSelectProfile: (purchase: StudentProfilePurchase) => Promise<StudentProfilePurchaseOutcome>;
  onOpenSection: (section: StudentStoreSection) => void;
  onBack: () => void;
}

export default function StudentStorePage({
  studentNumber,
  profileAssignments,
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  section,
  children,
  economyState,
  stockMarket,
  isEconomySaving,
  donation,
  onEconomyAction,
  onSelectProfile,
  onOpenSection,
  onBack,
}: StudentStorePageProps) {
  const isPlaza = section === 'plaza';
  const isSecurities = section === 'securities' || section === 'securities-trade';
  const marketDay = new Date(`${getKoreanDateKey()}T12:00:00Z`).getUTCDay();
  const marketClosed = isSecurities && (marketDay === 0 || marketDay === 6);
  const [selectedStockId, setSelectedStockId] = useState<StudentStockId>('sunny');
  const titles: Record<StudentStoreSection, string> = {
    plaza: '고마 쓰기', bank: '은행', shop: '상점', auction: '경매장', securities: '종목별 오늘의 변화', 'securities-trade': '종목별 오늘의 변화', donation: '기부',
  };
  return (
    <div className="student-view student-store-view" data-store-section={section}>
      <StudentHeader
        title={titles[section]}
        status={marketClosed ? '오늘은 휴장' : undefined}
        onBack={onBack}
        backLabel={isPlaza ? '개요로 돌아가기' : '광장으로 돌아가기'}
        backText={isPlaza ? '홈' : '광장'}
        actions={(
          <StudentBalanceSummary
            studentNumber={studentNumber}
            profileAssignments={profileAssignments}
            balance={balance}
            availableBalance={availableBalance}
            reservedAmount={reservedAmount}
            isLoading={isLoading}
          />
        )}
      />
      <div className="student-store-content">
        {section === 'plaza' ? <StudentPlaza onOpen={onOpenSection} /> : null}
        {section === 'bank' ? <StudentBankPage state={economyState} studentNumber={studentNumber} isSaving={isEconomySaving} onAction={onEconomyAction} /> : null}
        {section === 'shop' ? <StudentShopPage studentNumber={studentNumber} profileAssignments={profileAssignments} state={economyState} availableBalance={availableBalance} isSaving={isEconomySaving} onAction={onEconomyAction} onSelectProfile={onSelectProfile} /> : null}
        {section === 'auction' ? children : null}
        {isSecurities ? (
          <div className="student-securities-flow">
            <section id="student-investment-market" className="student-investment-market-section" aria-label="종목별 오늘의 변화">
              <StudentStockMarketPage
                state={economyState}
                market={stockMarket}
                isLoading={isLoading}
                isSaving={isEconomySaving}
                selectedStockId={selectedStockId}
                onSelectStock={setSelectedStockId}
                onAction={onEconomyAction}
              />
            </section>
            <StudentInvestmentActionPanel
              state={economyState}
              market={stockMarket}
              selectedStockId={selectedStockId}
              availableBalance={availableBalance}
              isSaving={isEconomySaving}
              onAction={onEconomyAction}
            />
          </div>
        ) : null}
        {section === 'donation' ? <StudentDonationPage {...donation} /> : null}
      </div>
    </div>
  );
}
