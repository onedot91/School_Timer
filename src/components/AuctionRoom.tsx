import type { ReactNode } from 'react';
import { Coins, Lock, Sparkles, Trophy } from 'lucide-react';
import {
  AUCTION_DAY_ACCENTS,
  AUCTION_WEEKDAY_LABELS,
  formatCurrency,
  getAuctionItemDisplayName,
  getStudentLabelStyle,
  type AuctionAwards,
  type AuctionBids,
  type AuctionItem,
  type AuctionMission,
} from '../lib/currency';

interface AuctionRoomProps {
  auctionItems: AuctionItem[];
  auctionBids: AuctionBids;
  auctionAwards?: AuctionAwards;
  auctionMissions: AuctionMission[];
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
  auctionMissions,
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
        <div className={`grid grid-cols-2 gap-2 ${isCompact ? 'sm:w-[17.5rem]' : 'sm:w-[25rem]'}`}>
          <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-[1rem] border-2 border-[#9FC7B8] bg-[#F2FBF7] text-[#007A57] ${
            isCompact ? 'gap-3 px-2.5 py-2' : 'gap-3.5 px-4 py-3.5 shadow-[0_14px_28px_rgba(0,122,87,0.12)]'
          }`}>
            <span className={`inline-flex items-center justify-center rounded-[0.8rem] bg-white ring-2 ring-[#CFE7DD] ${
              isCompact ? 'h-8 w-8' : 'h-11 w-11 shadow-sm'
            }`}>
              <Coins size={isCompact ? 16 : 22} strokeWidth={2.8} />
            </span>
            <div className="min-w-0">
              <div className={`font-black leading-none text-[#007A57] ${isCompact ? 'text-[0.7rem]' : 'text-[0.82rem]'}`}>사용 가능</div>
              <div className={`mt-1 font-mono font-black leading-tight text-[#18211E] ${isCompact ? 'text-[0.95rem]' : 'text-[1.35rem]'}`}>
                {isLoading ? '...' : formatCurrency(availableBalance)}
              </div>
            </div>
          </div>
          <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-[1rem] border-2 border-[#E1C38F] bg-[#FFFAF1] text-[#8A5A1F] ${
            isCompact ? 'gap-3 px-2.5 py-2' : 'gap-3.5 px-4 py-3.5 shadow-[0_14px_28px_rgba(154,100,24,0.12)]'
          }`}>
            <span className={`inline-flex items-center justify-center rounded-[0.8rem] bg-white ring-2 ring-[#EBD9BC] ${
              isCompact ? 'h-8 w-8' : 'h-11 w-11 shadow-sm'
            }`}>
              <Trophy size={isCompact ? 16 : 22} strokeWidth={2.8} />
            </span>
            <div className="min-w-0">
              <div className={`font-black leading-none text-[#8A5A1F] ${isCompact ? 'text-[0.7rem]' : 'text-[0.82rem]'}`}>예약</div>
              <div className={`mt-1 font-mono font-black leading-tight text-[#18211E] ${isCompact ? 'text-[0.95rem]' : 'text-[1.35rem]'}`}>
                {formatCurrency(reservedAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {auctionMissions.length > 0 ? (
        <section className={`border-b border-[#E4E9E6] bg-[#FFFDF8] ${
          isCompact ? 'px-3 py-3 md:px-4' : 'px-4 py-4 md:px-5'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={`section-title font-extrabold leading-tight text-[#18211E] ${
              isCompact ? 'text-[1.05rem]' : 'text-[1.2rem]'
            }`}>
              오늘의 미션
            </h2>
          </div>
          <div className={`mt-3 grid ${
            isCompact ? 'gap-2' : 'gap-2.5 md:grid-cols-2'
          }`}>
            {auctionMissions.map((mission) => (
              <div
                key={mission.id}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1rem] border border-[#E4D7C9] bg-white shadow-[0_8px_18px_rgba(154,100,24,0.06)] ${
                  isCompact ? 'px-3 py-2.5' : 'px-4 py-3'
                }`}
              >
                <div className="min-w-0">
                  <div className={`font-extrabold leading-snug text-[#2F241D] ${
                    isCompact ? 'text-[0.94rem]' : 'text-[1.02rem]'
                  }`}>
                    {mission.content}
                  </div>
                </div>
                <div className={`rounded-[0.8rem] border border-[#CFE2D8] bg-[#F2FBF7] font-mono font-black leading-none text-[#007A57] ${
                  isCompact ? 'px-2.5 py-2 text-[0.85rem]' : 'px-3 py-2.5 text-[0.95rem]'
                }`}>
                  {formatCurrency(mission.rewardAmount)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
              } ${isDayUnlocked ? '' : 'opacity-90'}`}
              style={{ borderColor: '#E4E9E6' }}
            >
              <div
                className={`flex items-center gap-2 border-b bg-white px-3 ${
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
                          : 'auction-item-card-locked cursor-not-allowed border-[#E3EBE6] bg-[#F8FAF8]'
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
                      {isUnlocked ? (
                        <div className="min-w-0">
                          <div className={`section-title truncate font-black leading-tight text-[#18211E] ${
                            isCompact ? 'text-[0.98rem]' : 'text-[1.1rem]'
                          }`}>
                            {itemDisplayName}
                          </div>
                        </div>
                      ) : (
                        <div className="relative min-h-[4.55rem] overflow-hidden rounded-[0.85rem] border border-[#E6EEE9] bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent.chip }} />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-3 flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#18211E] text-white shadow-[0_8px_16px_rgba(28,45,40,0.16)]">
                                  <Lock size={17} color="#FFFFFF" strokeWidth={3.4} />
                                </span>
                                <span className="h-7 w-12 rounded-full border border-[#DDE8E2] bg-[#F7FAF8]" />
                              </div>
                              <div className="grid gap-1.5">
                                <span className="h-3 w-4/5 rounded-full bg-[#DCE6E0]" />
                                <span className="h-3 w-3/5 rounded-full bg-[#E9EFEA]" />
                              </div>
                            </div>
                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.9rem] border border-[#DDE8E2] bg-[#F7FAF8] text-[#8EA099]">
                              <Sparkles size={18} />
                            </div>
                          </div>
                        </div>
                      )}

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
                            : null}
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
