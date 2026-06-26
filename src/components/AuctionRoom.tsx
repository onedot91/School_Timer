import type { ReactNode } from 'react';
import { Coins, Lock, Sparkles, Trophy } from 'lucide-react';
import {
  AUCTION_WEEKDAY_LABELS,
  formatCurrency,
  getStudentLabelStyle,
  type AuctionAwards,
  type AuctionBids,
  type AuctionItem,
} from '../lib/currency';

const AUCTION_DAY_ACCENTS = [
  { border: '#9FC7B8', bg: '#F1FAF5', chip: '#006241' },
  { border: '#D8B98B', bg: '#FFF8EC', chip: '#8A5A1F' },
  { border: '#91BDD0', bg: '#F0F8FB', chip: '#2F6F73' },
  { border: '#B8A6D2', bg: '#F8F4FC', chip: '#5F4B8B' },
  { border: '#D8A4A0', bg: '#FFF5F2', chip: '#8A4A3C' },
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
    <section className={`auction-room-shell overflow-hidden border border-[#C8DED2] bg-[#FFFDF8] ${
      isCompact
        ? 'rounded-[1.25rem] shadow-[0_10px_24px_rgba(31,24,18,0.08)]'
        : 'rounded-[2rem] shadow-[0_24px_70px_rgba(31,24,18,0.16)]'
    }`}>
      <div className={`auction-room-header grid gap-3 border-b border-[#E6D5C9] bg-[#F8FCF6] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        isCompact ? 'p-3 md:p-4' : 'p-4 md:p-5'
      }`}>
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 rounded-full bg-white font-black text-[#006241] shadow-sm ${
            isCompact ? 'px-2.5 py-1 text-[0.78rem]' : 'px-3 py-1.5 text-[0.82rem]'
          }`}>
            <Sparkles size={isCompact ? 13 : 15} />
            {studentLabel}
          </div>
          <h1 className={`section-title mt-2 font-extrabold leading-none text-[#2F241D] ${
            isCompact ? 'text-[1.85rem] md:text-[2.15rem]' : 'text-[clamp(2rem,5vw,3.6rem)]'
          }`}>
            오늘의 경매
          </h1>
        </div>
        <div className={`grid grid-cols-2 gap-2 ${isCompact ? 'sm:w-[17.5rem]' : 'sm:w-[21rem]'}`}>
          <div className={`rounded-[1rem] border-2 border-[#9FC7B8] bg-white text-[#006241] ${
            isCompact ? 'px-2.5 py-2' : 'px-3 py-2'
          }`}>
            <span className={`mb-1 inline-flex items-center justify-center rounded-[0.75rem] bg-[#EAF6F0] ${
              isCompact ? 'h-7 w-7' : 'h-8 w-8'
            }`}>
              <Coins size={isCompact ? 16 : 18} />
            </span>
            <div className={`font-mono font-black leading-tight text-[#1F2523] ${isCompact ? 'text-[0.95rem]' : 'text-[1.1rem]'}`}>
              {isLoading ? '...' : formatCurrency(availableBalance)}
            </div>
            <div className="text-[0.72rem] font-black">사용 가능</div>
          </div>
          <div className={`rounded-[1rem] border-2 border-[#E4D7C9] bg-white text-[#6E5139] ${
            isCompact ? 'px-2.5 py-2' : 'px-3 py-2'
          }`}>
            <span className={`mb-1 inline-flex items-center justify-center rounded-[0.75rem] bg-[#FFF7EC] ${
              isCompact ? 'h-7 w-7' : 'h-8 w-8'
            }`}>
              <Trophy size={isCompact ? 16 : 18} />
            </span>
            <div className={`font-mono font-black leading-tight text-[#1F2523] ${isCompact ? 'text-[0.95rem]' : 'text-[1.1rem]'}`}>
              {formatCurrency(reservedAmount)}
            </div>
            <div className="text-[0.72rem] font-black">예약</div>
          </div>
        </div>
      </div>

      <div className={`grid ${
        isCompact ? 'gap-2 p-3 md:grid-cols-5 md:p-4' : 'gap-3 p-4 md:p-5 lg:grid-cols-5'
      }`}>
        {auctionDayGroups.map(({ weekdayLabel, dayIndex, items, accent }) => {
          const isDayUnlocked = dayIndex < visibleDayCount;

          return (
            <div
              key={weekdayLabel}
              className={`overflow-hidden border bg-white shadow-[0_8px_18px_rgba(31,24,18,0.06)] ${
                isCompact ? 'rounded-[0.95rem]' : 'rounded-[1.05rem]'
              } ${isDayUnlocked ? '' : 'opacity-78'}`}
              style={{ borderColor: accent.border }}
            >
              <div
                className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${
                  isCompact ? 'min-h-[2.65rem]' : 'min-h-[2.9rem]'
                }`}
                style={{ borderColor: accent.border, backgroundColor: accent.bg }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-7 shrink-0 rounded-full shadow-sm"
                    style={{ backgroundColor: accent.chip }}
                  />
                  <div className={`section-title truncate font-extrabold text-[#2F241D] ${
                    isCompact ? 'text-[0.9rem]' : 'text-[0.98rem]'
                  }`}>
                    {weekdayLabel}요일
                  </div>
                </div>
                <span className={`rounded-full bg-white px-2 py-0.5 text-[0.62rem] font-black ${
                  isDayUnlocked ? 'text-[#006241]' : 'text-[#8A7A6B]'
                }`}>
                  {isDayUnlocked ? '공개' : '비공개'}
                </span>
              </div>

              <div className={`grid ${
                isCompact ? 'gap-2 p-2' : 'gap-2 p-2.5'
              }`}>
                {items.map((item, slotIndex) => {
                  const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
                  const award = auctionAwards?.[item.id] ?? null;
                  const isUnlocked = item.dayIndex < visibleDayCount;
                  const isSelected = selectedItem ? item.id === selectedItem.id : false;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (isUnlocked) onSelectItem?.(item);
                      }}
                      disabled={!isUnlocked}
                      className={`auction-item-card group relative overflow-hidden border text-left transition-all ${
                        isUnlocked && isSelected
                          ? 'border-[#006241] bg-[#EAF6F0] ring-2 ring-[#9FC7B8]'
                          : isUnlocked
                            ? 'border-[#E8DDD0] bg-white hover:-translate-y-1 hover:border-[#9FC7B8] hover:bg-[#F8FCF6]'
                            : 'cursor-not-allowed border-[#E5DFD8] bg-[#F4F0EA]'
                      } ${isCompact ? 'rounded-[0.85rem] p-2' : 'rounded-[0.9rem] p-2'}`}
                    >
                      <div className={`relative flex items-center rounded-[0.75rem] bg-[#EFF7F2] ${
                        isCompact ? 'min-h-[2.75rem] gap-2 px-2 py-1.5' : 'min-h-[3rem] gap-2 px-2.5 py-2'
                      }`}>
                        <span
                          className={`inline-flex shrink-0 items-center justify-center rounded-full px-2 font-mono font-black text-white shadow-md ${
                            isCompact ? 'h-6 min-w-6 text-[0.68rem]' : 'h-7 min-w-7 text-[0.72rem]'
                          }`}
                          style={{ backgroundColor: accent.chip }}
                        >
                          {slotIndex + 1}
                        </span>
                        <div className={`section-title min-w-0 flex-1 font-extrabold leading-tight text-[#2F241D] ${
                          isCompact ? 'text-[0.86rem]' : 'text-[0.94rem]'
                        }`}>
                          {isUnlocked ? item.name : '비공개'}
                        </div>
                        {!isUnlocked ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[0.85rem] bg-[#1F2523]/48 text-white backdrop-blur-[2px]">
                            <Lock size={24} />
                            <span className="mt-1 font-black">비공개</span>
                          </div>
                        ) : null}
                      </div>

                      <div className={isCompact ? 'pt-1.5' : 'pt-2'}>
                        <div className={`flex items-center justify-between gap-2 rounded-[0.72rem] border border-[#D7E6DE] bg-white ${
                          isCompact ? 'min-h-[2.1rem] px-2 py-1' : 'min-h-[2.25rem] px-2.5 py-1.5'
                        }`}>
                          {award && isUnlocked ? (
                            <span
                              className={`inline-flex shrink-0 items-center justify-center rounded-full px-2.5 font-mono font-black text-white ${
                                isCompact ? 'h-7 text-[0.76rem]' : 'h-8 text-[0.82rem]'
                              }`}
                              style={getStudentLabelStyle(award.winner)}
                            >
                              {award.winner}번
                            </span>
                          ) : currentBid.bidder && isUnlocked ? (
                            <span
                              className={`inline-flex shrink-0 items-center justify-center rounded-full px-2.5 font-mono font-black text-white ${
                                isCompact ? 'h-7 text-[0.76rem]' : 'h-8 text-[0.82rem]'
                              }`}
                              style={getStudentLabelStyle(currentBid.bidder)}
                            >
                              {currentBid.bidder}번
                            </span>
                          ) : null}
                          <div className={`min-w-0 flex-1 text-right font-mono font-black leading-none text-[#006241] ${
                            isCompact ? 'text-[0.84rem]' : 'text-[0.92rem]'
                          }`}>
                            {isUnlocked
                              ? award
                                ? formatCurrency(award.amount)
                                : formatCurrency(currentBid.amount)
                              : '???'}
                          </div>
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
