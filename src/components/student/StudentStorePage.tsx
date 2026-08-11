import type { ReactNode, RefObject } from 'react';
import type { StudentEconomyAction, StudentEconomyState } from '../../lib/studentEconomy';
import StudentBankPage from './StudentBankPage';
import StudentBalanceSummary from './StudentBalanceSummary';
import StudentDonationPage from './StudentDonationPage';
import StudentHeader from './StudentHeader';
import StudentPlaza, { type StudentStoreSection } from './StudentPlaza';
import StudentSecuritiesPage from './StudentSecuritiesPage';
import StudentShopPage from './StudentShopPage';

interface StudentStorePageProps {
  balance: number;
  availableBalance: number;
  reservedAmount: number;
  isLoading: boolean;
  section: StudentStoreSection;
  children?: ReactNode;
  economyState: StudentEconomyState;
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
  balance,
  availableBalance,
  reservedAmount,
  isLoading,
  section,
  children,
  economyState,
  isEconomySaving,
  donation,
  onEconomyAction,
  onOpenSection,
  onBack,
}: StudentStorePageProps) {
  const isPlaza = section === 'plaza';
  const titles: Record<StudentStoreSection, string> = {
    plaza: '고마 쓰기', bank: '은행', shop: '상점', auction: '경매장', securities: '증권사', donation: '기부',
  };
  return (
    <div className="student-view student-store-view">
      <StudentHeader
        title={titles[section]}
        onBack={onBack}
        backLabel={isPlaza ? '개요로 돌아가기' : '광장으로 돌아가기'}
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
        {section === 'bank' ? <StudentBankPage state={economyState} isSaving={isEconomySaving} onAction={onEconomyAction} /> : null}
        {section === 'shop' ? <StudentShopPage state={economyState} isSaving={isEconomySaving} onAction={onEconomyAction} /> : null}
        {section === 'auction' ? children : null}
        {section === 'securities' ? <StudentSecuritiesPage state={economyState} isSaving={isEconomySaving} onAction={onEconomyAction} /> : null}
        {section === 'donation' ? <StudentDonationPage {...donation} /> : null}
      </div>
    </div>
  );
}
