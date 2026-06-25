import { useEffect, useMemo, useState } from 'react';
import { Coins, Lock, Sparkles, Trophy } from 'lucide-react';
import {
  AUCTION_BID_STEP,
  AUCTION_ITEM_IDS,
  AUCTION_WEEKDAY_LABELS,
  DEFAULT_CURRENCY_BALANCE,
  DEFAULT_AUCTION_ITEMS,
  clampAuctionBidAmount,
  formatCurrency,
  getAuctionVisibleItemCount,
  normalizeAuctionBids,
  normalizeAuctionItems,
  normalizeCurrencyBalances,
  type AuctionItem,
  type AuctionBids,
  type CurrencyBalances,
} from '../lib/currency';
import {
  isSupabaseSettingsEnabled,
  loadSharedSettingsRow,
  updateSharedSettings,
} from '../lib/supabaseSettings';

interface AuctionPageProps {
  studentNumber: number;
}

const BIDDER_LABEL_COLORS = [
  '#2F6F73',
  '#315E9B',
  '#A95545',
  '#7A5A9E',
  '#B2793A',
  '#4F7F52',
  '#8A4F76',
  '#3E7895',
  '#9A6642',
  '#5E6F9F',
  '#7A783C',
  '#A34D64',
  '#4D697E',
  '#6F5C8F',
  '#8D6A3D',
  '#59646A',
  '#8F4E86',
  '#5A7B63',
  '#4D7D88',
  '#76548A',
  '#9B5F3F',
  '#3F7A6B',
  '#6A5F58',
];

const getBidderLabelStyle = (bidder: number) => ({
  backgroundColor: BIDDER_LABEL_COLORS[(bidder - 1) % BIDDER_LABEL_COLORS.length],
});

const getMinimumBid = (item: AuctionItem, currentAmount: number) => {
  const baseAmount = currentAmount > 0 ? currentAmount + AUCTION_BID_STEP : item.startPrice;
  return Math.max(item.startPrice, Math.ceil(baseAmount / AUCTION_BID_STEP) * AUCTION_BID_STEP);
};

const getReservedBidAmount = (bids: AuctionBids, studentNumber: number, excludedItemId?: string) =>
  Object.entries(bids).reduce((total, [itemId, bid]) => {
    if (itemId === excludedItemId || bid.bidder !== studentNumber) return total;
    return total + bid.amount;
  }, 0);

export default function AuctionPage({ studentNumber }: AuctionPageProps) {
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalances>(() => normalizeCurrencyBalances(null));
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>(() => normalizeAuctionItems(null));
  const [auctionBids, setAuctionBids] = useState<AuctionBids>(() => normalizeAuctionBids(null, AUCTION_ITEM_IDS));
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [selectedItemId, setSelectedItemId] = useState(DEFAULT_AUCTION_ITEMS[0]?.id ?? '');
  const [isLoading, setIsLoading] = useState(isSupabaseSettingsEnabled);
  const [isSubmittingItemId, setIsSubmittingItemId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const studentKey = String(studentNumber);
  const balance = currencyBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
  const reservedAmount = getReservedBidAmount(auctionBids, studentNumber);
  const availableBalance = Math.max(0, balance - reservedAmount);
  const visibleItemCount = getAuctionVisibleItemCount();
  const firstVisibleItem = auctionItems.find((_, index) => index < visibleItemCount) ?? null;

  const selectedItem = useMemo(
    () => {
      const selectedIndex = auctionItems.findIndex((item) => item.id === selectedItemId);
      if (selectedIndex >= 0 && selectedIndex < visibleItemCount) return auctionItems[selectedIndex];
      return firstVisibleItem;
    },
    [auctionItems, firstVisibleItem, selectedItemId, visibleItemCount],
  );

  const refreshAuctionState = async () => {
    if (!isSupabaseSettingsEnabled) {
      setCurrencyBalances(normalizeCurrencyBalances(null));
      setAuctionItems(normalizeAuctionItems(null));
      setAuctionBids(normalizeAuctionBids(null, AUCTION_ITEM_IDS));
      setIsLoading(false);
      return;
    }

    try {
      const row = await loadSharedSettingsRow();
      const value = row?.value && typeof row.value === 'object'
        ? (row.value as { currencyBalances?: unknown; auctionBids?: unknown; auctionItems?: unknown })
        : {};
      setCurrencyBalances(normalizeCurrencyBalances(value.currencyBalances));
      setAuctionItems(normalizeAuctionItems(value.auctionItems));
      setAuctionBids(normalizeAuctionBids(value.auctionBids, AUCTION_ITEM_IDS));
    } catch (error) {
      console.error('Failed to load auction state from Supabase.', error);
      setStatusMessage('경매 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuctionState();
    if (!isSupabaseSettingsEnabled) return;

    const intervalId = window.setInterval(() => {
      void refreshAuctionState();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [studentNumber]);

  const selectItem = (item: AuctionItem) => {
    const itemIndex = auctionItems.findIndex((auctionItem) => auctionItem.id === item.id);
    if (itemIndex < 0 || itemIndex >= visibleItemCount) return;

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    const minimumBid = getMinimumBid(item, currentBid.amount);
    setSelectedItemId(item.id);
    setBidAmounts((previous) => ({
      ...previous,
      [item.id]: Math.max(minimumBid, clampAuctionBidAmount(previous[item.id] ?? minimumBid)),
    }));
  };

  const submitBid = async (item: AuctionItem) => {
    if (isSubmittingItemId) return;

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    const minimumBid = getMinimumBid(item, currentBid.amount);
    const bidAmount = clampAuctionBidAmount(bidAmounts[item.id] ?? minimumBid);
    const reservedExcludingItem = getReservedBidAmount(auctionBids, studentNumber, item.id);
    const availableForItem = Math.max(0, balance - reservedExcludingItem);

    if (bidAmount < minimumBid) {
      setStatusMessage(`${formatCurrency(minimumBid)}부터 입찰할 수 있습니다.`);
      return;
    }

    if (bidAmount > availableForItem) {
      setStatusMessage('예약금을 제외한 사용 가능 고마가 부족합니다.');
      return;
    }

    setIsSubmittingItemId(item.id);
    setStatusMessage('');

    try {
      if (isSupabaseSettingsEnabled) {
        await updateSharedSettings((currentValue) => {
          const currentObject = currentValue && typeof currentValue === 'object'
            ? (currentValue as Record<string, unknown>)
            : {};
          const currentBalances = normalizeCurrencyBalances(currentObject.currencyBalances);
          const currentBids = normalizeAuctionBids(currentObject.auctionBids, AUCTION_ITEM_IDS);
          const latestBalance = currentBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
          const latestBid = currentBids[item.id] ?? { amount: 0, bidder: null };
          const latestMinimumBid = getMinimumBid(item, latestBid.amount);
          const latestReservedExcludingItem = getReservedBidAmount(currentBids, studentNumber, item.id);
          const latestAvailableForItem = Math.max(0, latestBalance - latestReservedExcludingItem);

          if (bidAmount > latestAvailableForItem) {
            throw new Error('INSUFFICIENT_FUNDS');
          }

          if (bidAmount < latestMinimumBid) {
            throw new Error('BID_TOO_LOW');
          }

          return {
            ...currentObject,
            version: 1,
            currencyBalances: currentBalances,
            auctionBids: {
              ...currentBids,
              [item.id]: {
                amount: bidAmount,
                bidder: studentNumber,
              },
            },
          };
        });
        await refreshAuctionState();
      } else {
        setAuctionBids((previous) => ({
          ...previous,
          [item.id]: {
            amount: bidAmount,
            bidder: studentNumber,
          },
        }));
      }

      setBidAmounts((previous) => ({ ...previous, [item.id]: bidAmount + AUCTION_BID_STEP }));
      setStatusMessage('입찰이 완료되었습니다.');
    } catch (error) {
      console.error('Failed to submit auction bid.', error);
      setStatusMessage(error instanceof Error && error.message === 'INSUFFICIENT_FUNDS'
        ? '예약금을 제외한 사용 가능 고마가 부족합니다.'
        : error instanceof Error && error.message === 'BID_TOO_LOW'
          ? '현재 최고 입찰가보다 높게 입찰해야 합니다.'
          : '입찰을 처리하지 못했습니다. 다시 시도해 주세요.');
      await refreshAuctionState();
    } finally {
      setIsSubmittingItemId(null);
    }
  };

  return (
    <div className="auction-page min-h-[100dvh] w-full overflow-y-auto px-3 py-3 sm:px-5 md:py-5">
      <main className="mx-auto w-full max-w-7xl">
        <section className="auction-room-shell overflow-hidden rounded-[2rem] border border-[#C8DED2] bg-[#FFFDF8] shadow-[0_24px_70px_rgba(31,24,18,0.16)]">
          <div className="auction-room-header grid gap-3 border-b border-[#E6D5C9] bg-[#F8FCF6] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:p-5">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[0.82rem] font-black text-[#006241] shadow-sm">
                <Sparkles size={15} />
                {studentNumber}번
              </div>
              <h1 className="section-title mt-2 text-[clamp(2rem,5vw,3.6rem)] font-extrabold leading-none text-[#2F241D]">
                오늘의 경매
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-[21rem]">
              <div className="rounded-[1rem] border-2 border-[#9FC7B8] bg-white px-3 py-2 text-[#006241]">
                <span className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-[0.75rem] bg-[#EAF6F0]">
                  <Coins size={18} />
                </span>
                <div className="font-mono text-[1.1rem] font-black leading-tight text-[#1F2523]">
                  {isLoading ? '...' : formatCurrency(availableBalance)}
                </div>
                <div className="text-[0.72rem] font-black">사용 가능</div>
              </div>
              <div className="rounded-[1rem] border-2 border-[#E4D7C9] bg-white px-3 py-2 text-[#6E5139]">
                <span className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-[0.75rem] bg-[#FFF7EC]">
                  <Trophy size={18} />
                </span>
                <div className="font-mono text-[1.1rem] font-black leading-tight text-[#1F2523]">
                  {formatCurrency(reservedAmount)}
                </div>
                <div className="text-[0.72rem] font-black">예약</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 md:p-5 lg:grid-cols-5">
            {auctionItems.map((item) => {
              const itemIndex = auctionItems.findIndex((auctionItem) => auctionItem.id === item.id);
              const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
              const isUnlocked = itemIndex < visibleItemCount;
              const isSelected = selectedItem ? item.id === selectedItem.id : false;
              const weekdayLabel = AUCTION_WEEKDAY_LABELS[itemIndex] ?? '';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  disabled={!isUnlocked}
                  className={`auction-item-card group relative overflow-hidden rounded-[1.25rem] border p-3 text-left shadow-[0_10px_22px_rgba(31,24,18,0.08)] transition-all ${
                    isUnlocked && isSelected
                      ? 'border-[#006241] bg-[#EAF6F0] ring-2 ring-[#9FC7B8]'
                      : isUnlocked
                        ? 'border-[#E8DDD0] bg-white hover:-translate-y-1 hover:border-[#9FC7B8] hover:bg-[#F8FCF6]'
                        : 'cursor-not-allowed border-[#E5DFD8] bg-[#F4F0EA] opacity-78'
                  }`}
                >
                  <div className="relative flex min-h-[4.7rem] items-center gap-3 rounded-[1rem] bg-[#EFF7F2] px-3 py-3">
                    <span className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-2 font-mono text-sm font-black shadow-md ${
                      isUnlocked ? 'bg-[#006241] text-white' : 'bg-white text-[#8A7A6B]'
                    }`}>
                      {weekdayLabel}
                    </span>
                    <div className="section-title min-w-0 flex-1 text-[1.2rem] font-extrabold leading-tight text-[#2F241D]">
                      {isUnlocked ? item.name : '비공개'}
                    </div>
                    {!isUnlocked ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[1rem] bg-[#1F2523]/48 text-white backdrop-blur-[2px]">
                        <Lock size={28} />
                        <span className="mt-1 font-black">{weekdayLabel}요일 공개</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-2.5">
                    <div className="flex min-h-[2.9rem] items-center justify-between gap-2 rounded-[0.9rem] border border-[#D7E6DE] bg-white px-3 py-2">
                      {currentBid.bidder && isUnlocked ? (
                        <span
                          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full px-2.5 font-mono text-[0.82rem] font-black text-white"
                          style={getBidderLabelStyle(currentBid.bidder)}
                        >
                          {currentBid.bidder}번
                        </span>
                      ) : null}
                      <div className="min-w-0 flex-1 text-right font-mono text-[1.08rem] font-black leading-none text-[#006241]">
                        {isUnlocked ? formatCurrency(currentBid.amount) : '???'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedItem ? (() => {
            const currentBid = auctionBids[selectedItem.id] ?? { amount: 0, bidder: null };
            const minimumBid = getMinimumBid(selectedItem, currentBid.amount);
            const reservedExcludingItem = getReservedBidAmount(auctionBids, studentNumber, selectedItem.id);
            const maxBid = clampAuctionBidAmount(Math.max(0, balance - reservedExcludingItem));
            const selectedBidAmount = Math.max(
              minimumBid,
              clampAuctionBidAmount(bidAmounts[selectedItem.id] ?? minimumBid),
            );
            const canSubmit =
              !isLoading &&
              isSubmittingItemId === null &&
              selectedBidAmount >= minimumBid &&
              selectedBidAmount <= maxBid;

            return (
              <div className="mx-4 mb-4 rounded-[1.35rem] border-2 border-[#9FC7B8] bg-[#F8FCF6] p-3 shadow-[0_10px_22px_rgba(31,24,18,0.08)] md:mx-5 md:mb-5">
                <div className="mb-3">
                  <div>
                    <h2 className="section-title min-w-0 text-[1.45rem] font-extrabold leading-tight text-[#2F241D]">
                      {selectedItem.name}
                    </h2>
                    <p className="font-mono text-[0.9rem] font-black text-[#006241]">
                      최고가 {formatCurrency(currentBid.amount)} · 시작가 {formatCurrency(selectedItem.startPrice)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2 sm:grid-cols-[3.2rem_minmax(0,1fr)_3.2rem_10rem]">
                  <button
                    type="button"
                    onClick={() => setBidAmounts((previous) => ({
                      ...previous,
                      [selectedItem.id]: Math.max(minimumBid, selectedBidAmount - AUCTION_BID_STEP),
                    }))}
                    className="inline-flex h-12 items-center justify-center rounded-[0.9rem] border-2 border-[#E4D7C9] bg-white text-[1.35rem] font-black text-[#6E5139] transition-colors hover:bg-[#FFF7EC]"
                    aria-label={`${selectedItem.name} 입찰가 낮추기`}
                  >
                    -
                  </button>
                  <div className="inline-flex h-12 items-center justify-center rounded-[0.9rem] border-2 border-[#CFE0D8] bg-white px-2 text-center font-mono text-[1.15rem] font-black text-[#1F2523]">
                    {formatCurrency(selectedBidAmount)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setBidAmounts((previous) => ({
                      ...previous,
                      [selectedItem.id]: Math.min(maxBid, selectedBidAmount + AUCTION_BID_STEP),
                    }))}
                    className="inline-flex h-12 items-center justify-center rounded-[0.9rem] border-2 border-[#9FC7B8] bg-[#EAF6F0] text-[1.35rem] font-black text-[#006241] transition-colors hover:bg-[#DDF0E8]"
                    aria-label={`${selectedItem.name} 입찰가 올리기`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitBid(selectedItem)}
                    disabled={!canSubmit}
                    className="col-span-3 inline-flex h-12 w-full items-center justify-center rounded-[0.9rem] bg-[#006241] text-[1rem] font-extrabold text-white transition-colors hover:bg-[#005336] disabled:cursor-not-allowed disabled:bg-[#C9D4CD] disabled:text-white/82 sm:col-span-1"
                  >
                    {isSubmittingItemId === selectedItem.id ? '...' : '입찰'}
                  </button>
                </div>
              </div>
            );
          })() : null}
          {visibleItemCount === 0 ? (
            <div className="mx-4 mb-4 rounded-[1.35rem] border-2 border-dashed border-[#D7E6DE] bg-white p-6 text-center text-[1.1rem] font-black text-[#6E5139] md:mx-5 md:mb-5">
              월요일부터 하나씩 공개됩니다.
            </div>
          ) : null}
        </section>
      </main>
      {statusMessage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4"
          role="presentation"
          onClick={() => setStatusMessage('')}
        >
          <div
            className="w-full max-w-[18rem] rounded-[1.35rem] border-2 border-[#9FC7B8] bg-white px-5 py-4 text-center shadow-[0_24px_60px_rgba(31,24,18,0.22)]"
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-mono text-[1.35rem] font-black text-[#006241]">{statusMessage}</p>
            <button
              type="button"
              onClick={() => setStatusMessage('')}
              className="mt-4 inline-flex h-10 min-w-[6.5rem] items-center justify-center rounded-[0.85rem] bg-[#006241] px-4 text-[0.95rem] font-extrabold text-white transition-colors hover:bg-[#005336]"
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
