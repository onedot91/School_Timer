import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Circle, Coins, LoaderCircle, Lock, Sparkles, Trophy } from 'lucide-react';
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
  variant?: 'page' | 'compact';
  footer?: ReactNode;
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

      <div className={`auction-mission-strip grid border-b border-[#E4E9E6] bg-[#FAFCFB] ${
        isCompact
          ? 'gap-2 px-3 py-3 md:px-4'
          : `gap-3 px-4 py-3 md:px-5 ${auctionMissions.length > 0
              ? 'md:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]'
              : 'md:grid-cols-1'}`
      }`}>
        {auctionMissions.length > 0 ? (
          <section className="auction-mission-group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[1rem] border border-[#E4D7C9] bg-white px-3 py-2.5">
            <h2 className="section-title whitespace-nowrap text-[0.92rem] font-extrabold text-[#6E5139]">일일 미션</h2>
            <div className="flex min-w-0 flex-wrap gap-2">
              {auctionMissions.map((mission) => (
                <div key={mission.id} className="inline-flex min-w-0 shrink-0 items-center gap-2 rounded-full bg-[#FFF8EC] px-3 py-2">
                  <span className="max-w-[14rem] truncate text-[0.92rem] font-extrabold text-[#2F241D]">{mission.content}</span>
                  <span className="font-mono text-[0.84rem] font-black text-[#007A57]">{formatCurrency(mission.rewardAmount)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <section
          className={`auction-mission-group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-[1rem] border px-3 py-2.5 ${
            WEEKLY_MISSION_DEFINITIONS.every((mission) => weeklyMissionStatuses[mission.type] === 'completed')
              ? 'border-[#9FC7B8] bg-[#F2FBF7]'
              : 'border-[#DCE7E1] bg-white'
          }`}
          aria-busy={WEEKLY_MISSION_DEFINITIONS.some((mission) => weeklyMissionStatuses[mission.type] === 'loading')}
        >
          <h2 className="section-title whitespace-nowrap pt-2 text-[0.92rem] font-extrabold text-[#2F3834]">주간 미션</h2>
          <div className="auction-weekly-mission-list grid min-w-0 gap-2">
            {WEEKLY_MISSION_DEFINITIONS.map((mission) => {
              const status = weeklyMissionStatuses[mission.type];
              return (
                <div key={mission.type} className="auction-weekly-mission-row grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                    status === 'completed'
                      ? 'bg-[#007A57] text-white'
                      : status === 'unavailable'
                        ? 'bg-[#FFF4E8] text-[#9A6418]'
                        : status === 'loading'
                          ? 'bg-[#EAF5F1] text-[#007A57]'
                          : 'bg-[#EEF4F1] text-[#7A8780]'
                  }`} aria-hidden="true">
                    {status === 'completed'
                      ? <CheckCircle2 size={20} strokeWidth={2.8} />
                      : status === 'unavailable'
                        ? <AlertCircle size={20} strokeWidth={2.4} />
                        : status === 'loading'
                          ? <LoaderCircle className="animate-spin" size={20} strokeWidth={2.4} />
                          : <Circle size={20} strokeWidth={2.4} />}
                  </span>
                  <div className={`min-w-0 truncate text-[0.94rem] font-extrabold leading-snug ${
                    status === 'completed' ? 'text-[#006B4D]' : 'text-[#2F3834]'
                  }`}>
                    {mission.label}
                  </div>
                  <div className={`whitespace-nowrap rounded-full border px-3 py-2 font-mono text-[0.85rem] font-black leading-none ${
                    status === 'completed'
                      ? 'border-[#9FC7B8] bg-white text-[#007A57]'
                      : 'border-[#CFE2D8] bg-[#F2FBF7] text-[#007A57]'
                  }`}>
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
        </section>
      </div>

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

          <div className={`auction-main-layout mt-3 grid gap-3 ${footer ? 'lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)]' : ''}`}>
            <section className="auction-current-day overflow-hidden rounded-[1.25rem] border border-[#DCE7E1] bg-white">
              <div className="flex min-h-14 items-center gap-3 border-b border-[#E9EFEB] px-4 py-3">
                <span className="h-2.5 w-8 rounded-full" style={{ backgroundColor: activeDayGroup.accent.chip }} />
                <h2 className="section-title text-[1.22rem] font-black text-[#18211E]">{activeDayGroup.weekdayLabel}요일</h2>
              </div>
              <div className="auction-current-items grid gap-3 p-3 md:grid-cols-2">
                {activeDayGroup.items.map((item) => {
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
                        <div className="min-w-0">
                          <div className="section-title truncate text-[1.18rem] font-black leading-tight text-[#18211E]">
                            {itemDisplayName}
                          </div>
                        </div>
                      ) : (
                        <div className="relative min-h-[4.55rem] overflow-hidden rounded-[0.85rem] border border-[#E6EEE9] bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: activeDayGroup.accent.chip }} />
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
            {footer ? <aside className="auction-bid-area min-w-0">{footer}</aside> : null}
          </div>
        </div>
      ) : null}

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
