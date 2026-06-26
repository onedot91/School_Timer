import type { ReactNode } from 'react';
import { Coins, Lock, Sparkles, Trophy } from 'lucide-react';
import {
  AUCTION_WEEKDAY_LABELS,
  formatCurrency,
  getAuctionItemDisplayName,
  getStudentLabelStyle,
  type AuctionAwards,
  type AuctionBids,
  type AuctionItem,
} from '../lib/currency';

const AUCTION_DAY_ACCENTS = [
  { border: '#9CCDBE', soft: '#F6FBF8', chip: '#007A57' },
  { border: '#E1C38F', soft: '#FFFBF3', chip: '#9A6418' },
  { border: '#9CCFDA', soft: '#F6FCFD', chip: '#1C7D88' },
  { border: '#BFADE0', soft: '#FBF9FE', chip: '#6A4B9B' },
  { border: '#E3AAA5', soft: '#FFFAF9', chip: '#A34F45' },
];

interface AuctionRoomProps {
  auctionItems: AuctionItem[];
  auctionBids: AuctionBids;
  auctionAwards?: AuctionAwards;
  availableBalance: number;
  reservedAmount: number;
  visibleDayCount: number;
  selectedItemId?: string | null;
  studentLabel: string;
  isLoading?: boolean;
  variant?: 'page' | 'compact';
  footer?: ReactNode;
  onSelectItem?: (item: AuctionItem) => void;
}

export default function AuctionRoom({
  auctionItems,
  auctionBids,
  auctionAwards,
  availableBalance,
  reservedAmount,
  visibleDayCount,
  selectedItemId,
  studentLabel,
  isLoading = false,
  variant = 'page',
  footer,
  onSelectItem,
}: AuctionRoomProps) {
  const isCompact = variant === 'compact';
  const firstVisibleItem = auctionItems.find((item) => item.dayIndex < visibleDayCount) ?? null;
  const selectedIndex = selectedItemId
    ? auctionItems.findIndex((item) => item.id === selectedItemId)
    : -1;
  const selectedAuctionItem = selectedIndex >= 0 ? auctionItems[selectedIndex] : null;
  const selectedItem =
    selectedAuctionItem && selectedAuctionItem.dayIndex < visibleDayCount
      ? selectedAuctionItem
      : firstVisibleItem;
  const auctionDayGroups = AUCTION_WEEKDAY_LABELS.map((weekdayLabel, dayIndex) => ({
    weekdayLabel,
    dayIndex,
    items: auctionItems.filter((item) => item.dayIndex === dayIndex),
    accent: AUCTION_DAY_ACCENTS[dayIndex] ?? AUCTION_DAY_ACCENTS[0],
  })).filter((group) => group.items.length > 0);

  return (
    <section className={`auction-room-shell overflow-hidden border border-[#D8E4DE] bg-white ${
      isCompact
        ? 'rounded-[1.25rem] shadow-[0_10px_22px_rgba(28,45,40,0.07)]'
        : 'rounded-[2rem] shadow-[0_22px_54px_rgba(28,45,40,0.1)]'
    }`}>
      <div className={`auction-room-header grid gap-3 border-b border-[#E4E9E6] bg-white sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        isCompact ? 'p-3 md:p-4' : 'p-4 md:p-5'
      }`}>
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 rounded-full border border-[#DCE7E1] bg-[#FAFCFB] font-black text-[#007A57] ${
            isCompact ? 'px-2.5 py-1 text-[0.78rem]' : 'px-3 py-1.5 text-[0.82rem]'
          }`}>
            <Sparkles size={isCompact ? 13 : 15} />
            {studentLabel}
          </div>
          <h1 className={`section-title mt-2 font-extrabold leading-none text-[#18211E] ${
            isCompact ? 'text-[1.85rem] md:text-[2.15rem]' : 'text-[clamp(2rem,5vw,3.6rem)]'
          }`}>
            오늘의 경매
          </h1>
        </div>
        <div className={`grid grid-cols-2 gap-2 ${isCompact ? 'sm:w-[17.5rem]' : 'sm:w-[21rem]'}`}>
          <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[1rem] border border-[#DCE7E1] bg-[#FAFCFB] text-[#007A57] ${
            isCompact ? 'px-2.5 py-2' : 'px-3 py-2.5'
          }`}>
            <span className={`inline-flex items-center justify-center rounded-[0.75rem] bg-white ring-1 ring-[#DCE7E1] ${
              isCompact ? 'h-8 w-8' : 'h-9 w-9'
            }`}>
              <Coins size={isCompact ? 16 : 18} />
            </span>
            <div className="min-w-0">
              <div className="text-[0.7rem] font-black leading-none text-[#007A57]">사용 가능</div>
              <div className={`mt-1 font-mono font-black leading-tight text-[#1F2523] ${isCompact ? 'text-[0.95rem]' : 'text-[1.08rem]'}`}>
                {isLoading ? '...' : formatCurrency(availableBalance)}
              </div>
            </div>
          </div>
          <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[1rem] border border-[#E6DED3] bg-[#FFFDF9] text-[#8A5A1F] ${
            isCompact ? 'px-2.5 py-2' : 'px-3 py-2.5'
          }`}>
            <span className={`inline-flex items-center justify-center rounded-[0.75rem] bg-white ring-1 ring-[#E6DED3] ${
              isCompact ? 'h-8 w-8' : 'h-9 w-9'
            }`}>
              <Trophy size={isCompact ? 16 : 18} />
            </span>
            <div className="min-w-0">
              <div className="text-[0.7rem] font-black leading-none text-[#8A5A1F]">예약</div>
              <div className={`mt-1 font-mono font-black leading-tight text-[#1F2523] ${isCompact ? 'text-[0.95rem]' : 'text-[1.08rem]'}`}>
                {formatCurrency(reservedAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`grid ${
        isCompact ? 'gap-2.5 p-3 md:grid-cols-5 md:p-4' : 'gap-4 p-4 md:p-5 lg:grid-cols-5'
      }`}>
        {auctionDayGroups.map(({ weekdayLabel, dayIndex, items, accent }) => {
          const isDayUnlocked = dayIndex < visibleDayCount;

          return (
            <div
              key={weekdayLabel}
              className={`overflow-hidden border bg-white shadow-[0_10px_24px_rgba(28,45,40,0.045)] ${
                isCompact ? 'rounded-[1rem]' : 'rounded-[1.2rem]'
              } ${isDayUnlocked ? '' : 'opacity-78'}`}
              style={{ borderColor: '#E4E9E6' }}
            >
              <div
                className={`flex items-center justify-between gap-2 border-b bg-white px-3 ${
                  isCompact ? 'min-h-[2.75rem] py-2' : 'min-h-[3.1rem] py-2.5'
                }`}
                style={{ borderColor: '#EEF2EF' }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent.chip }}
                  />
                  <div className={`section-title truncate font-extrabold text-[#1F2523] ${
                    isCompact ? 'text-[0.9rem]' : 'text-[0.98rem]'
                  }`}>
                    {weekdayLabel}요일
                  </div>
                </div>
                <span className={`rounded-full border border-[#E5ECE8] bg-[#FAFCFB] px-2 py-0.5 text-[0.62rem] font-black ${
                  isDayUnlocked ? 'text-[#007A57]' : 'text-[#8A7A6B]'
                }`}>
                  {isDayUnlocked ? '공개' : '비공개'}
                </span>
              </div>

              <div className={`grid ${
                isCompact ? 'gap-2 p-2' : 'gap-2 p-2.5'
              }`}>
                {items.map((item) => {
                  const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
                  const award = auctionAwards?.[item.id] ?? null;
                  const isUnlocked = item.dayIndex < visibleDayCount;
                  const isSelected = selectedItem ? item.id === selectedItem.id : false;
                  const itemDisplayName = getAuctionItemDisplayName(item.name, item.dayIndex);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (isUnlocked) onSelectItem?.(item);
                      }}
                      disabled={!isUnlocked}
                      className={`auction-item-card group relative overflow-hidden border text-left transition-all ${
                        isUnlocked
                          ? 'bg-white hover:-translate-y-0.5'
                          : 'cursor-not-allowed border-[#E5DFD8] bg-[#F4F0EA]'
                      } ${isCompact ? 'rounded-[0.95rem] p-3' : 'rounded-[1.05rem] p-3.5'}`}
                      style={
                        isUnlocked
                          ? {
                              borderColor: isSelected ? accent.chip : '#E6ECE8',
                              backgroundColor: isSelected ? accent.soft : '#FFFFFF',
                              boxShadow: isSelected
                                ? `inset 4px 0 0 ${accent.chip}, 0 12px 24px rgba(28,45,40,0.08)`
                                : undefined,
                            }
                          : undefined
                      }
                    >
                      <div className="relative">
                        <div className="min-w-0">
                          <div className={`section-title truncate font-black leading-tight text-[#18211E] ${
                            isCompact ? 'text-[0.98rem]' : 'text-[1.1rem]'
                          }`}>
                            {isUnlocked ? itemDisplayName : '비공개'}
                          </div>
                        </div>
                        {!isUnlocked ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[0.85rem] bg-[#18211E]/54 text-white backdrop-blur-[2px]">
                            <Lock size={24} />
                            <span className="mt-1 font-black">비공개</span>
                          </div>
                        ) : null}
                      </div>

                      <div className={`mt-4 flex items-end justify-between gap-2 border-t border-[#EDF2EF] ${
                        isCompact ? 'pt-2.5' : 'pt-3.5'
                      }`}>
                        <div className="min-w-[3.6rem]">
                          {award && isUnlocked ? (
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-2.5 font-mono font-black text-white ${
                                isCompact ? 'h-7 text-[0.76rem]' : 'h-8 text-[0.84rem]'
                              }`}
                              style={getStudentLabelStyle(award.winner)}
                            >
                              {award.winner}번
                            </span>
                          ) : currentBid.bidder && isUnlocked ? (
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-2.5 font-mono font-black text-white ${
                                isCompact ? 'h-7 text-[0.76rem]' : 'h-8 text-[0.84rem]'
                              }`}
                              style={getStudentLabelStyle(currentBid.bidder)}
                            >
                              {currentBid.bidder}번
                            </span>
                          ) : null}
                        </div>
                        <div className={`min-w-0 flex-1 text-right font-mono font-black leading-none ${
                          isCompact ? 'text-[1.08rem]' : 'text-[1.26rem]'
                        }`} style={{ color: isUnlocked ? accent.chip : '#6E7A72' }}>
                          {isUnlocked
                            ? award
                              ? formatCurrency(award.amount)
                              : formatCurrency(currentBid.amount)
                            : '???'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {footer}
      {visibleDayCount === 0 ? (
        <div className={`rounded-[1.35rem] border-2 border-dashed border-[#D7E6DE] bg-white text-center font-black text-[#6E5139] ${
          isCompact ? 'mx-3 mb-3 p-4 text-[1rem]' : 'mx-4 mb-4 p-6 text-[1.1rem] md:mx-5 md:mb-5'
        }`}>
          오늘은 공개된 물품이 없습니다.
        </div>
      ) : null}
    </section>
  );
}
