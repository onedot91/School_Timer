import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Circle, Coins, LoaderCircle, Lock, Package, Sparkles, Trophy } from 'lucide-react';
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
import {
  WEEKLY_MISSION_DEFINITIONS,
  type WeeklyMissionStatuses,
} from '../lib/weeklyMission';

interface AuctionRoomProps {
  auctionItems: AuctionItem[];
  auctionBids: AuctionBids;
  auctionAwards?: AuctionAwards;
  auctionMissions: AuctionMission[];
  weeklyMissionStatuses: WeeklyMissionStatuses;
  availableBalance: number;
  reservedAmount: number;
  visibleDayCount: number;
  selectedItemId?: string | null;
  studentLabel: string;
  isLoading?: boolean;
  showStudentSummary?: boolean;
  variant?: 'page' | 'compact';
  footer?: ReactNode;
  donationWidget?: ReactNode;
  onSelectItem?: (item: AuctionItem) => void;
}

export default function AuctionRoom({
  auctionItems,
  auctionBids,
  auctionAwards,
  auctionMissions,
  weeklyMissionStatuses,
  availableBalance,
  reservedAmount,
  visibleDayCount,
  selectedItemId,
  studentLabel,
  isLoading = false,
  showStudentSummary = true,
  variant = 'page',
  footer,
  donationWidget,
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
  const currentDayIndex = visibleDayCount > 0
    ? Math.min(visibleDayCount - 1, AUCTION_WEEKDAY_LABELS.length - 1)
    : 0;
  const selectedDayIndex = selectedItem?.dayIndex ?? currentDayIndex;
  const [activeDayIndex, setActiveDayIndex] = useState(selectedDayIndex);

  useEffect(() => {
    setActiveDayIndex(selectedDayIndex);
  }, [selectedDayIndex]);

  const activeDayGroup = auctionDayGroups.find((group) => group.dayIndex === activeDayIndex)
    ?? auctionDayGroups.find((group) => group.dayIndex === currentDayIndex)
    ?? auctionDayGroups[0];

  const selectDay = (dayIndex: number) => {
    if (dayIndex >= visibleDayCount) return;
    setActiveDayIndex(dayIndex);
    const firstItem = auctionDayGroups.find((group) => group.dayIndex === dayIndex)?.items[0];
    if (firstItem) onSelectItem?.(firstItem);
  };

  return (
    <section className={`auction-room-shell overflow-hidden border border-[#D8E4DE] bg-white ${
      isCompact
        ? 'rounded-[1.25rem] shadow-[0_10px_22px_rgba(28,45,40,0.07)]'
        : 'rounded-[2rem] shadow-[0_22px_54px_rgba(28,45,40,0.1)]'
    }`}>
      {showStudentSummary ? <>
      <div className={`auction-room-header grid gap-3 border-b border-[#E4E9E6] bg-white sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        isCompact ? 'p-3 md:p-4' : 'p-3.5 md:px-5 md:py-4'
      }`}>
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 rounded-full border border-[#DCE7E1] bg-[#FAFCFB] font-black text-[#007A57] ${
            isCompact ? 'px-2.5 py-1 text-[0.78rem]' : 'px-3 py-1.5 text-[0.82rem]'
          }`}>
            <Sparkles size={isCompact ? 13 : 15} />
            {studentLabel}
          </div>
          <h1 className={`section-title mt-2 font-extrabold leading-none text-[#18211E] ${
            isCompact ? 'text-[1.85rem] md:text-[2.15rem]' : 'text-[clamp(2rem,4.5vw,3.2rem)]'
          }`}>
            오늘의 경매
          </h1>
        </div>
        <div className={`auction-balance-grid grid grid-cols-2 gap-2 ${isCompact ? 'sm:w-[17.5rem]' : 'sm:w-[25rem]'}`}>
          <div className={`auction-balance-item grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-[1rem] border-2 border-[#9FC7B8] bg-[#F2FBF7] text-[#007A57] ${
            isCompact ? 'gap-3 px-2.5 py-2' : 'gap-3.5 px-4 py-3.5 shadow-[0_14px_28px_rgba(0,122,87,0.12)]'
          }`}>
            <span className={`inline-flex items-center justify-center rounded-[0.8rem] bg-white ring-2 ring-[#CFE7DD] ${
              isCompact ? 'h-8 w-8' : 'h-11 w-11 shadow-sm'
            }`}>
              <Coins size={isCompact ? 16 : 22} strokeWidth={2.8} />
            </span>
            <div className="min-w-0">
              <div className={`font-black leading-none text-[#007A57] ${isCompact ? 'text-[0.7rem]' : 'text-[0.82rem]'}`}>사용 가능</div>
              <div className={`mt-1 whitespace-nowrap font-mono font-black leading-tight text-[#18211E] ${isCompact ? 'text-[0.95rem]' : 'text-[1.35rem]'}`}>
                {isLoading ? '...' : formatCurrency(availableBalance)}
              </div>
            </div>
          </div>
          <div className={`auction-balance-item grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-[1rem] border-2 border-[#E1C38F] bg-[#FFFAF1] text-[#8A5A1F] ${
            isCompact ? 'gap-3 px-2.5 py-2' : 'gap-3.5 px-4 py-3.5 shadow-[0_14px_28px_rgba(154,100,24,0.12)]'
          }`}>
            <span className={`inline-flex items-center justify-center rounded-[0.8rem] bg-white ring-2 ring-[#EBD9BC] ${
              isCompact ? 'h-8 w-8' : 'h-11 w-11 shadow-sm'
            }`}>
              <Trophy size={isCompact ? 16 : 22} strokeWidth={2.8} />
            </span>
            <div className="min-w-0">
              <div className={`font-black leading-none text-[#8A5A1F] ${isCompact ? 'text-[0.7rem]' : 'text-[0.82rem]'}`}>예약</div>
              <div className={`mt-1 whitespace-nowrap font-mono font-black leading-tight text-[#18211E] ${isCompact ? 'text-[0.95rem]' : 'text-[1.35rem]'}`}>
                {formatCurrency(reservedAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`auction-mission-strip border-b border-[#E4E9E6] bg-[#FAFCFB] ${
        isCompact ? 'px-3 py-2.5 md:px-4' : 'px-4 py-2.5 md:px-5'
      }`}>
        <section
          className={`auction-mission-board overflow-hidden rounded-[1rem] border bg-white ${
            WEEKLY_MISSION_DEFINITIONS.every((mission) => weeklyMissionStatuses[mission.type] === 'completed')
              ? 'border-[#9FC7B8]'
              : 'border-[#DCE7E1]'
          }`}
          aria-busy={WEEKLY_MISSION_DEFINITIONS.some((mission) => weeklyMissionStatuses[mission.type] === 'loading')}
        >
          {auctionMissions.length > 0 ? (
            <div className="auction-mission-board-row grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] items-center border-b border-[#E8ECEA] px-3 py-2">
              <h2 className="section-title whitespace-nowrap text-[0.86rem] font-extrabold text-[#6E5139]">일일 미션</h2>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {auctionMissions.map((mission) => (
                  <div key={mission.id} className="inline-flex min-w-0 items-center gap-2 rounded-full bg-[#FFF8EC] px-3 py-1.5">
                    <span className="max-w-[13rem] truncate text-[0.86rem] font-extrabold text-[#2F241D]">{mission.content}</span>
                    <span className="whitespace-nowrap font-mono text-[0.8rem] font-black text-[#007A57]">{formatCurrency(mission.rewardAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="auction-mission-board-row grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] items-center px-3 py-2">
            <h2 className="section-title whitespace-nowrap text-[0.86rem] font-extrabold text-[#2F3834]">주간 미션</h2>
            <div className="auction-weekly-mission-list grid min-w-0 grid-cols-1 gap-1.5 lg:grid-cols-3">
              {WEEKLY_MISSION_DEFINITIONS.map((mission) => {
                const status = weeklyMissionStatuses[mission.type];
                return (
                  <div key={mission.type} className={`auction-weekly-mission-row grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[0.8rem] px-2 py-1 ${
                    status === 'completed' ? 'bg-[#F2FBF7]' : 'bg-[#FAFCFB]'
                  }`}>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                      status === 'completed'
                        ? 'bg-[#007A57] text-white'
                        : status === 'unavailable'
                          ? 'bg-[#FFF4E8] text-[#9A6418]'
                          : status === 'loading'
                            ? 'bg-[#EAF5F1] text-[#007A57]'
                            : 'bg-[#EEF4F1] text-[#7A8780]'
                    }`} aria-hidden="true">
                      {status === 'completed'
                        ? <CheckCircle2 size={17} strokeWidth={2.8} />
                        : status === 'unavailable'
                          ? <AlertCircle size={17} strokeWidth={2.4} />
                          : status === 'loading'
                            ? <LoaderCircle className="animate-spin" size={17} strokeWidth={2.4} />
                            : <Circle size={17} strokeWidth={2.4} />}
                    </span>
                    <div className={`min-w-0 truncate text-[0.84rem] font-extrabold leading-snug ${
                      status === 'completed' ? 'text-[#006B4D]' : 'text-[#2F3834]'
                    }`}>
                      {mission.label}
                    </div>
                    <div className="whitespace-nowrap font-mono text-[0.78rem] font-black leading-none text-[#007A57]">
                      +{formatCurrency(mission.rewardAmount)}
                    </div>
                    <span className="sr-only">
                      {status === 'completed'
                        ? '완료'
                        : status === 'incomplete'
                          ? '미완료'
                          : status === 'loading'
                            ? '확인 중'
                            : '확인 불가'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      </> : null}

      {activeDayGroup ? (
        <div className={`auction-workspace ${isCompact ? 'p-3 md:p-4' : 'p-4 md:p-5'}`}>
          <nav className="auction-day-tabs grid grid-cols-5 gap-2" aria-label="경매 요일">
            {auctionDayGroups.map(({ weekdayLabel, dayIndex, items, accent }) => {
              const isUnlocked = dayIndex < visibleDayCount;
              const isActive = dayIndex === activeDayGroup.dayIndex;
              const isCurrent = dayIndex === currentDayIndex && visibleDayCount > 0;
              return (
                <button
                  key={weekdayLabel}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => selectDay(dayIndex)}
                  aria-pressed={isActive}
                  className={`auction-day-tab inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] border px-3 font-extrabold ${
                    isActive ? 'text-white' : isUnlocked ? 'bg-white text-[#38423D]' : 'cursor-not-allowed bg-[#F4F6F5] text-[#9AA39E]'
                  }`}
                  style={isActive ? { backgroundColor: accent.chip, borderColor: accent.chip } : undefined}
                >
                  <span>{weekdayLabel}요일</span>
                  {isCurrent ? <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : 'bg-[#007A57]'}`} /> : null}
                  <span className="sr-only">{items.length}개</span>
                </button>
              );
            })}
          </nav>

          <div className={`auction-main-layout mt-3 grid gap-3 ${footer || donationWidget ? 'lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)]' : ''}`}>
            <section className="auction-current-day overflow-hidden rounded-[1.25rem] border border-[#DCE7E1] bg-white">
              <div className="flex min-h-14 items-center gap-3 border-b border-[#E9EFEB] px-4 py-3">
                <span className="h-2.5 w-8 rounded-full" style={{ backgroundColor: activeDayGroup.accent.chip }} />
                <h2 className="section-title text-[1.22rem] font-black text-[#18211E]">{activeDayGroup.weekdayLabel}요일</h2>
              </div>
              <div className="auction-current-items grid gap-3 p-3 md:grid-cols-2">
                {activeDayGroup.dayIndex >= visibleDayCount ? (
                  <div className="auction-locked-day-state md:col-span-2">
                    <span><Lock size={22} aria-hidden="true" /></span>
                    <div>
                      <strong>물품 공개 전</strong>
                      <p>경매가 열리는 날 확인할 수 있어요.</p>
                    </div>
                  </div>
                ) : activeDayGroup.items.map((item) => {
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
                      aria-pressed={isUnlocked ? isSelected : undefined}
                      className={`auction-item-card group relative overflow-hidden border p-4 text-left ${
                        isUnlocked
                          ? 'bg-white hover:-translate-y-0.5'
                          : 'auction-item-card-locked cursor-not-allowed border-[#E3EBE6] bg-[#F8FAF8]'
                      } rounded-[1.05rem]`}
                      style={
                        isUnlocked
                          ? {
                              borderColor: isSelected ? activeDayGroup.accent.chip : '#E6ECE8',
                              backgroundColor: isSelected ? activeDayGroup.accent.soft : '#FFFFFF',
                              boxShadow: isSelected
                                ? `inset 5px 0 0 ${activeDayGroup.accent.chip}, 0 12px 24px rgba(28,45,40,0.08)`
                                : undefined,
                            }
                          : undefined
                      }
                    >
                      {isUnlocked ? (
                        <div className="auction-item-identity min-w-0">
                          <span className="auction-item-art" aria-hidden="true"><Package /></span>
                          <div className="section-title truncate text-[1.18rem] font-black leading-tight text-[#18211E]">
                            {itemDisplayName}
                          </div>
                        </div>
                      ) : (
                        <div className="relative min-h-[4.55rem] overflow-hidden rounded-[0.85rem] border border-[#CBD8D1] bg-white/88 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: activeDayGroup.accent.chip }} />
                          <div className="flex min-h-[4rem] items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#24312B] text-white shadow-[0_8px_16px_rgba(28,45,40,0.16)]">
                              <Lock size={19} color="#FFFFFF" strokeWidth={3} />
                            </span>
                            <div className="min-w-0">
                              <div className="section-title text-[1rem] font-black text-[#38423D]">잠긴 물품</div>
                              <div className="mt-1 text-[0.78rem] font-extrabold text-[#66736C]">해당 요일에 공개됩니다</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-end justify-between gap-2 border-t border-[#EDF2EF] pt-3.5">
                        <div className="min-w-[3.6rem]">
                          {award && isUnlocked ? (
                            <span
                              className="inline-flex h-8 items-center justify-center rounded-full px-2.5 font-mono text-[0.84rem] font-black text-white"
                              style={getStudentLabelStyle(award.winner)}
                            >
                              {award.winner}번
                            </span>
                          ) : currentBid.bidder && isUnlocked ? (
                            <span
                              className="inline-flex h-8 items-center justify-center rounded-full px-2.5 font-mono text-[0.84rem] font-black text-white"
                              style={getStudentLabelStyle(currentBid.bidder)}
                            >
                              {currentBid.bidder}번
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 text-right font-mono text-[1.26rem] font-black leading-none" style={{ color: isUnlocked ? activeDayGroup.accent.chip : '#6E7A72' }}>
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
            </section>
            {footer || donationWidget ? (
              <aside className="auction-bid-area grid min-w-0 content-start gap-3">
                {footer}
                {donationWidget}
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}

    </section>
  );
}
