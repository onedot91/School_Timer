import { useState, type ReactNode, type RefObject } from 'react';
import type { StudentEconomyAction, StudentEconomyState, StudentShopCatalogItem, StudentStockId, StudentStockMarket } from '../../lib/studentEconomy';
import StudentBankPage from './StudentBankPage';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentDonationPage from './StudentDonationPage';
import StudentHeader from './StudentHeader';
import StudentInvestmentActionPanel from './StudentInvestmentActionPanel';
import StudentPlaza, { type StudentStoreSection } from './StudentPlaza';
import StudentSecuritiesPage from './StudentSecuritiesPage';
import StudentShopPage from './StudentShopPage';
import StudentStockMarketPage from './StudentStockMarketPage';

interface StudentStorePageProps {
  studentNumber: number;
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  section: StudentStoreSection;
  children?: ReactNode;
  economyState: StudentEconomyState;
  shopCatalog: StudentShopCatalogItem[];
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
  onOpenSection: (section: StudentStoreSection) => void;
  onBack: () => void;
}

export default function StudentStorePage({
  studentNumber,
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  section,
  children,
  economyState,
  shopCatalog,
  stockMarket,
  isEconomySaving,
  donation,
  onEconomyAction,
  onOpenSection,
  onBack,
}: StudentStorePageProps) {
  const isPlaza = section === 'plaza';
  const isSecurities = section === 'securities' || section === 'securities-trade';
  const [selectedStockId, setSelectedStockId] = useState<StudentStockId>('sunny');
  const titles: Record<StudentStoreSection, string> = {
    plaza: '고마 쓰기', bank: '은행', shop: '상점', auction: '경매장', securities: '내 투자', 'securities-trade': '내 투자', donation: '기부',
  };
  return (
    <div className="student-view student-store-view" data-store-section={section}>
      <StudentHeader
        title={titles[section]}
        onBack={onBack}
        backLabel={isPlaza ? '개요로 돌아가기' : '광장으로 돌아가기'}
        backText={isPlaza ? '홈' : '광장'}
        actions={(
          <StudentBalanceSummary
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
        {section === 'shop' ? <StudentShopPage state={economyState} catalog={shopCatalog} availableBalance={availableBalance} isSaving={isEconomySaving} onAction={onEconomyAction} /> : null}
        {section === 'auction' ? children : null}
        {isSecurities ? (
          <div className="student-securities-flow">
            <StudentSecuritiesPage
              state={economyState}
              market={stockMarket}
            />
            <section id="student-investment-market" className="student-investment-market-section" aria-labelledby="student-investment-market-title">
              <h2 id="student-investment-market-title">종목별 오늘의 변화</h2>
              <StudentStockMarketPage
                state={economyState}
                market={stockMarket}
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
