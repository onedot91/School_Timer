import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Circle, Coins, LoaderCircle, Lock, Sparkles, Trophy } from 'lucide-react';
import {
  AUCTION_DAY_ACCENTS,
  AUCTION_WEEKDAY_LABELS,
  formatCurrency,
  formatMissionReward,
  type AuctionAwards,
  type AuctionBids,
  type AuctionItem,
  type AuctionMission,
} from '../lib/currency';
import type { FailureProfileAssignments } from '../lib/failureExhibition';
import {
  WEEKLY_MISSION_DEFINITIONS,
  type WeeklyMissionStatuses,
} from '../lib/weeklyMission';
import { AuctionItemCard } from './AuctionItemCard';

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
  profileAssignments: FailureProfileAssignments;
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
  profileAssignments,
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
  const activeAuctionSlots = activeDayGroup
    ? Array.from({ length: 6 }, (_, slotIndex) => activeDayGroup.items[slotIndex] ?? null)
    : [];

  const selectDay = (dayIndex: number) => {
    if (dayIndex >= visibleDayCount) return;
    setActiveDayIndex(dayIndex);
    const firstItem = auctionDayGroups.find((group) => group.dayIndex === dayIndex)?.items[0];
    if (firstItem) onSelectItem?.(firstItem);
  };

  const handleDayTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, dayIndex: number) => {
    const unlockedDayIndexes = auctionDayGroups
      .filter((group) => group.dayIndex < visibleDayCount)
      .map((group) => group.dayIndex);
    const currentIndex = unlockedDayIndexes.indexOf(dayIndex);
    if (currentIndex < 0 || unlockedDayIndexes.length === 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + unlockedDayIndexes.length) % unlockedDayIndexes.length;
    } else if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % unlockedDayIndexes.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = unlockedDayIndexes.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextDayIndex = unlockedDayIndexes[nextIndex];
    selectDay(nextDayIndex);
    requestAnimationFrame(() => {
      document.getElementById(`auction-day-tab-${nextDayIndex}`)?.focus();
    });
  };

  return (
    <section className={`auction-room-shell overflow-hidden border border-[var(--apple-separator)] bg-white ${
      isCompact
        ? 'rounded-[1.25rem] shadow-[0_10px_22px_rgba(28,45,40,0.07)]'
        : 'rounded-[2rem] shadow-[0_22px_54px_rgba(28,45,40,0.1)]'
    }`}>
      {showStudentSummary ? <>
      <div className={`auction-room-header grid gap-3 border-b border-[var(--apple-separator)] bg-white sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        isCompact ? 'p-3 md:p-4' : 'p-3.5 md:px-5 md:py-4'
      }`}>
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 rounded-full border border-[var(--apple-separator)] bg-[var(--apple-surface-tint)] font-black text-[var(--apple-accent)] ${
            isCompact ? 'px-2.5 py-1 text-[length:var(--type-caption)]' : 'px-3 py-1.5 text-[length:var(--type-label)]'
          }`}>
            <Sparkles size={isCompact ? 13 : 15} />
            {studentLabel}
          </div>
          <h1 className="section-title mt-2 text-[length:var(--type-display)] font-extrabold leading-none text-[var(--apple-text-primary)]">
            오늘의 경매
          </h1>
        </div>
        <div className={`auction-balance-grid grid grid-cols-2 gap-2 ${isCompact ? 'sm:w-[17.5rem]' : 'sm:w-[25rem]'}`}>
          <div className={`auction-balance-item grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-[1rem] border-2 border-[#9FC7B8] bg-[var(--apple-control-hover)] text-[var(--apple-accent)] ${
            isCompact ? 'gap-3 px-2.5 py-2' : 'gap-3.5 px-4 py-3.5 shadow-[0_14px_28px_rgba(0,122,87,0.12)]'
          }`}>
            <span className={`inline-flex items-center justify-center rounded-[0.8rem] bg-white ring-2 ring-[#CFE7DD] ${
              isCompact ? 'h-8 w-8' : 'h-11 w-11 shadow-sm'
            }`}>
              <Coins size={isCompact ? 16 : 22} strokeWidth={2.8} />
            </span>
            <div className="min-w-0">
              <div className={`font-black leading-none text-[var(--apple-accent)] ${isCompact ? 'text-[length:var(--type-caption)]' : 'text-[length:var(--type-label)]'}`}>사용 가능</div>
              <div className={`mt-1 whitespace-nowrap font-mono font-black leading-tight text-[var(--apple-text-primary)] ${isCompact ? 'text-[length:var(--type-body)]' : 'text-[length:var(--type-title)]'}`}>
                {isLoading ? '...' : formatCurrency(availableBalance)}
              </div>
            </div>
          </div>
          <div className={`auction-balance-item grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-[1rem] border-2 border-[#E1C38F] bg-[var(--paper)] text-[#8A5A1F] ${
            isCompact ? 'gap-3 px-2.5 py-2' : 'gap-3.5 px-4 py-3.5 shadow-[0_14px_28px_rgba(154,100,24,0.12)]'
          }`}>
            <span className={`inline-flex items-center justify-center rounded-[0.8rem] bg-white ring-2 ring-[#EBD9BC] ${
              isCompact ? 'h-8 w-8' : 'h-11 w-11 shadow-sm'
            }`}>
              <Trophy size={isCompact ? 16 : 22} strokeWidth={2.8} />
            </span>
            <div className="min-w-0">
              <div className={`font-black leading-none text-[#8A5A1F] ${isCompact ? 'text-[length:var(--type-caption)]' : 'text-[length:var(--type-label)]'}`}>예약</div>
              <div className={`mt-1 whitespace-nowrap font-mono font-black leading-tight text-[var(--apple-text-primary)] ${isCompact ? 'text-[length:var(--type-body)]' : 'text-[length:var(--type-title)]'}`}>
                {formatCurrency(reservedAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`auction-mission-strip border-b border-[var(--apple-separator)] bg-[var(--apple-surface-tint)] ${
        isCompact ? 'px-3 py-2.5 md:px-4' : 'px-4 py-2.5 md:px-5'
      }`}>
        <section
          className={`auction-mission-board overflow-hidden rounded-[1rem] border bg-white ${
            WEEKLY_MISSION_DEFINITIONS.every((mission) => weeklyMissionStatuses[mission.type] === 'completed')
              ? 'border-[#9FC7B8]'
              : 'border-[var(--apple-separator)]'
          }`}
          aria-busy={WEEKLY_MISSION_DEFINITIONS.some((mission) => weeklyMissionStatuses[mission.type] === 'loading')}
        >
          {auctionMissions.length > 0 ? (
            <div className="auction-mission-board-row grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] items-center border-b border-[var(--apple-separator)] px-3 py-2">
              <h2 className="section-title whitespace-nowrap text-[length:var(--type-body-sm)] font-extrabold text-[#6E5139]">일일 미션</h2>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {auctionMissions.map((mission) => (
                  <div key={mission.id} className="inline-flex min-w-0 items-center gap-2 rounded-full bg-[var(--paper)] px-3 py-1.5">
                    <span className="max-w-[13rem] truncate text-[length:var(--type-body-sm)] font-extrabold text-[var(--ink)]">{mission.content}</span>
                    <span className="whitespace-nowrap font-mono text-[length:var(--type-label)] font-black text-[var(--apple-accent)]">{formatMissionReward(mission.rewardAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="auction-mission-board-row grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] items-center px-3 py-2">
            <h2 className="section-title whitespace-nowrap text-[length:var(--type-body-sm)] font-extrabold text-[var(--apple-text-primary)]">주간 미션</h2>
            <div className="auction-weekly-mission-list grid min-w-0 grid-cols-1 gap-1.5 lg:grid-cols-3">
              {WEEKLY_MISSION_DEFINITIONS.map((mission) => {
                const status = weeklyMissionStatuses[mission.type];
                return (
                  <div key={mission.type} className={`auction-weekly-mission-row grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[0.8rem] px-2 py-1 ${
                    status === 'completed' ? 'bg-[var(--apple-control-hover)]' : 'bg-[var(--apple-surface-tint)]'
                  }`}>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                      status === 'completed'
                        ? 'bg-[var(--apple-accent)] text-white'
                        : status === 'unavailable'
                          ? 'bg-[var(--cream)] text-[#9A6418]'
                          : status === 'loading'
                            ? 'bg-[var(--apple-control-hover)] text-[var(--apple-accent)]'
                            : 'bg-[var(--apple-surface-muted)] text-[var(--apple-text-tertiary)]'
                    }`} aria-hidden="true">
                      {status === 'completed'
                        ? <CheckCircle2 size={17} strokeWidth={2.8} />
                        : status === 'unavailable'
                          ? <AlertCircle size={17} strokeWidth={2.4} />
                          : status === 'loading'
                            ? <LoaderCircle className="animate-spin" size={17} strokeWidth={2.4} />
                            : <Circle size={17} strokeWidth={2.4} />}
                    </span>
                    <div className={`min-w-0 truncate text-[length:var(--type-label)] font-extrabold leading-snug ${
                      status === 'completed' ? 'text-[var(--apple-accent-pressed)]' : 'text-[var(--apple-text-primary)]'
                    }`}>
                      {mission.label}
                    </div>
                    <div className="whitespace-nowrap font-mono text-[length:var(--type-caption)] font-black leading-none text-[var(--apple-accent)]">
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
        <div
          className={`auction-workspace ${isCompact ? 'p-3 md:p-4' : 'p-4 md:p-5'}`}
          data-active-item-count={activeDayGroup.items.length}
        >
          <nav
            className="auction-day-tabs grid grid-cols-5 gap-2"
            aria-label="경매 요일"
            aria-orientation="horizontal"
            role="tablist"
          >
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
                  onKeyDown={(event) => handleDayTabKeyDown(event, dayIndex)}
                  id={`auction-day-tab-${dayIndex}`}
                  role="tab"
                  aria-controls="auction-day-panel"
                  aria-selected={isActive}
                  tabIndex={isActive && isUnlocked ? 0 : -1}
                  className={`auction-day-tab inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] border px-3 text-[length:var(--type-body)] font-extrabold ${
                    isActive ? 'text-white' : isUnlocked ? 'bg-white text-[var(--apple-text-primary)]' : 'cursor-not-allowed bg-[var(--apple-canvas)] text-[var(--apple-disabled-ink)]'
                  }`}
                  style={isActive ? { backgroundColor: accent.chip, borderColor: accent.chip } : undefined}
                >
                  <span>{weekdayLabel}요일</span>
                  {isCurrent ? <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : 'bg-[var(--apple-accent)]'}`} /> : null}
                  <span className="sr-only">{items.length}개</span>
                </button>
              );
            })}
          </nav>

          <div
            className={`auction-main-layout mt-3 grid gap-3 ${footer || donationWidget ? 'lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)]' : ''}`}
            data-active-item-count={activeDayGroup.items.length}
          >
            <section
              id="auction-day-panel"
              role="tabpanel"
              aria-labelledby={`auction-day-tab-${activeDayGroup.dayIndex}`}
              className="auction-current-day overflow-hidden rounded-[1.25rem] border border-[var(--apple-separator)] bg-white"
              data-item-count={activeDayGroup.items.length}
            >
              <div className="flex min-h-14 items-center gap-3 border-b border-[var(--apple-separator)] px-4 py-3">
                <span className="h-2.5 w-8 rounded-full" style={{ backgroundColor: activeDayGroup.accent.chip }} />
                <h2 className="section-title text-[length:var(--type-heading)] font-black text-[var(--apple-text-primary)]">{activeDayGroup.weekdayLabel}요일</h2>
              </div>
              <div className="auction-current-items grid gap-3 p-3 md:grid-cols-2" data-item-count={activeDayGroup.items.length}>
                {activeDayGroup.dayIndex >= visibleDayCount ? (
                  <div className="auction-locked-day-state md:col-span-2">
                    <span><Lock size={22} aria-hidden="true" /></span>
                    <div>
                      <strong>물품 공개 전</strong>
                      <p>경매가 열리는 날 확인할 수 있어요.</p>
                    </div>
                  </div>
                ) : activeAuctionSlots.map((item, slotIndex) => {
                  if (!item) {
                    return (
                      <div key={`empty-${slotIndex}`} className="auction-item-slot-empty" aria-hidden="true">
                        <span>빈 자리</span>
                      </div>
                    );
                  }

                  const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
                  const award = auctionAwards?.[item.id] ?? null;
                  const isUnlocked = item.dayIndex < visibleDayCount;
                  const isSelected = selectedItem ? item.id === selectedItem.id : false;
                  return (
                    <AuctionItemCard
                      key={item.id}
                      item={item}
                      currentBid={currentBid}
                      award={award}
                      accent={activeDayGroup.accent}
                      isUnlocked={isUnlocked}
                      isSelected={isSelected}
                      profileAssignments={profileAssignments}
                      onSelect={(selected) => onSelectItem?.(selected)}
                    />
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
