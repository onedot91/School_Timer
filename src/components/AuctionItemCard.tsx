import { Lock } from 'lucide-react';
import {
  AUCTION_DAY_ACCENTS,
  formatCurrency,
  getAuctionItemDisplayName,
  type AuctionAward,
  type AuctionBid,
  type AuctionItem,
} from '../lib/currency';
import {
  getFailureProfileImage,
  type FailureProfileAssignments,
} from '../lib/failureExhibition';

type AuctionDayAccent = (typeof AUCTION_DAY_ACCENTS)[number];

interface AuctionItemCardProps {
  readonly key?: string;
  readonly item: AuctionItem;
  readonly currentBid: AuctionBid;
  readonly award: AuctionAward | null;
  readonly accent: AuctionDayAccent;
  readonly isUnlocked: boolean;
  readonly isSelected: boolean;
  readonly profileAssignments: FailureProfileAssignments;
  readonly onSelect: (item: AuctionItem) => void;
}

export function AuctionItemCard({
  item,
  currentBid,
  award,
  accent,
  isUnlocked,
  isSelected,
  profileAssignments,
  onSelect,
}: AuctionItemCardProps) {
  const itemDisplayName = getAuctionItemDisplayName(item.name, item.dayIndex);
  const leadingStudentNumber = award?.winner ?? currentBid.bidder;
  const currentAmount = award?.amount ?? currentBid.amount;
  const leadingProfile = leadingStudentNumber === null
    ? null
    : getFailureProfileImage(leadingStudentNumber, profileAssignments);
  const bidderLabel = award ? '낙찰자' : '최고 입찰';

  return (
    <button
      type="button"
      onClick={() => {
        if (isUnlocked) onSelect(item);
      }}
      disabled={!isUnlocked}
      aria-pressed={isUnlocked ? isSelected : undefined}
      aria-label={isUnlocked
        ? `${itemDisplayName}, 현재가 ${formatCurrency(currentAmount)}${leadingStudentNumber === null ? ', 입찰 전' : `, ${bidderLabel} ${leadingStudentNumber}번`}`
        : '잠긴 물품, 해당 요일에 공개됩니다'}
      className={`auction-item-card group relative overflow-hidden border text-left ${
        isUnlocked
          ? 'bg-white hover:-translate-y-0.5'
          : 'auction-item-card-locked cursor-not-allowed border-[#E3EBE6] bg-[#F8FAF8]'
      } rounded-[1.05rem]`}
      style={isUnlocked
        ? {
            borderColor: isSelected ? accent.chip : '#E6ECE8',
            backgroundColor: isSelected ? accent.soft : '#FFFFFF',
            boxShadow: isSelected
              ? `inset 5px 0 0 ${accent.chip}, 0 12px 24px rgba(28,45,40,0.08)`
              : undefined,
          }
        : undefined}
    >
      {isUnlocked ? (
        <div className="auction-item-card-content">
          <div className="auction-item-identity min-w-0">
            <h3 className="section-title truncate font-black leading-tight text-[#18211E]">
              {itemDisplayName}
            </h3>
          </div>

          <div className="auction-item-current-bid" style={{ color: accent.chip }}>
            <span>현재가</span>
            <strong>{formatCurrency(currentAmount)}</strong>
          </div>

          <div className="auction-item-bidder">
            {leadingStudentNumber !== null && leadingProfile !== null ? (
              <>
                <img
                  src={leadingProfile}
                  alt=""
                  width={192}
                  height={192}
                  decoding="async"
                />
                <span>
                  <small>{bidderLabel}</small>
                  <strong>{leadingStudentNumber}번</strong>
                </span>
              </>
            ) : (
              <span className="auction-item-no-bid">입찰 전</span>
            )}
          </div>
        </div>
      ) : (
        <div className="auction-item-locked-content">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent.chip }} />
          <span className="auction-item-lock-icon">
            <Lock size={19} color="#FFFFFF" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <strong>잠긴 물품</strong>
            <p>해당 요일에 공개됩니다</p>
          </div>
        </div>
      )}
    </button>
  );
}
