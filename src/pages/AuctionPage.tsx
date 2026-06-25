import { useEffect, useMemo, useState } from 'react';
import { Coins, Gavel } from 'lucide-react';
import {
  DEFAULT_CURRENCY_BALANCE,
  formatCurrency,
  normalizeAuctionBids,
  normalizeCurrencyBalances,
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

interface AuctionItem {
  id: string;
  name: string;
  startPrice: number;
}

const AUCTION_ITEMS: AuctionItem[] = [
  { id: 'seat-pass', name: '자리 선택권', startPrice: 10 },
  { id: 'helper-pass', name: '도우미 면제권', startPrice: 10 },
  { id: 'music-pass', name: '노래 신청권', startPrice: 5 },
  { id: 'draw-pass', name: '추첨 1회권', startPrice: 10 },
  { id: 'bonus-pass', name: '보너스 쿠폰', startPrice: 20 },
];

const AUCTION_ITEM_IDS = AUCTION_ITEMS.map((item) => item.id);
const BID_STEP = 5;

const clampBidAmount = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.floor(numericValue / BID_STEP) * BID_STEP);
};

const getMinimumBid = (item: AuctionItem, currentAmount: number) => {
  const baseAmount = currentAmount > 0 ? currentAmount + BID_STEP : item.startPrice;
  return Math.max(item.startPrice, Math.ceil(baseAmount / BID_STEP) * BID_STEP);
};

export default function AuctionPage({ studentNumber }: AuctionPageProps) {
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalances>(() => normalizeCurrencyBalances(null));
  const [auctionBids, setAuctionBids] = useState<AuctionBids>(() => normalizeAuctionBids(null, AUCTION_ITEM_IDS));
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [selectedItemId, setSelectedItemId] = useState(AUCTION_ITEMS[0]?.id ?? '');
  const [isLoading, setIsLoading] = useState(isSupabaseSettingsEnabled);
  const [isSubmittingItemId, setIsSubmittingItemId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const studentKey = String(studentNumber);
  const balance = currencyBalances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;

  const selectedItem = useMemo(
    () => AUCTION_ITEMS.find((item) => item.id === selectedItemId) ?? AUCTION_ITEMS[0],
    [selectedItemId],
  );

  const refreshAuctionState = async () => {
    if (!isSupabaseSettingsEnabled) {
      setCurrencyBalances(normalizeCurrencyBalances(null));
      setAuctionBids(normalizeAuctionBids(null, AUCTION_ITEM_IDS));
      setIsLoading(false);
      return;
    }

    try {
      const row = await loadSharedSettingsRow();
      const value = row?.value && typeof row.value === 'object'
        ? (row.value as { currencyBalances?: unknown; auctionBids?: unknown })
        : {};
      setCurrencyBalances(normalizeCurrencyBalances(value.currencyBalances));
      setAuctionBids(normalizeAuctionBids(value.auctionBids, AUCTION_ITEM_IDS));
    } catch (error) {
      console.error('Failed to load auction state from Supabase.', error);
      setStatusMessage('오류');
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
    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    const minimumBid = getMinimumBid(item, currentBid.amount);
    setSelectedItemId(item.id);
    setBidAmounts((previous) => ({
      ...previous,
      [item.id]: Math.max(minimumBid, clampBidAmount(previous[item.id] ?? minimumBid)),
    }));
  };

  const submitBid = async (item: AuctionItem) => {
    if (isSubmittingItemId) return;

    const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
    const minimumBid = getMinimumBid(item, currentBid.amount);
    const bidAmount = clampBidAmount(bidAmounts[item.id] ?? minimumBid);

    if (bidAmount < minimumBid) {
      setStatusMessage(`${formatCurrency(minimumBid)}부터`);
      return;
    }

    if (bidAmount > balance) {
      setStatusMessage('고마 부족');
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

          if (bidAmount > latestBalance) {
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

      setBidAmounts((previous) => ({ ...previous, [item.id]: bidAmount + BID_STEP }));
      setStatusMessage('완료');
    } catch (error) {
      console.error('Failed to submit auction bid.', error);
      setStatusMessage(error instanceof Error && error.message === 'INSUFFICIENT_FUNDS'
        ? '고마 부족'
        : error instanceof Error && error.message === 'BID_TOO_LOW'
          ? '더 높게'
          : '다시 시도');
      await refreshAuctionState();
    } finally {
      setIsSubmittingItemId(null);
    }
  };

  return (
    <div className="auction-page min-h-[100dvh] w-full overflow-y-auto px-4 py-4 sm:px-6 md:py-5">
      <main className="mx-auto w-full max-w-7xl">
        <section className="rounded-[2rem] border border-[#D7E6DE] bg-white/94 p-4 shadow-[0_24px_60px_rgba(31,24,18,0.14)] sm:p-5">
          <div className="mb-4 border-b border-[#E6D5C9] pb-4">
            <div className="min-w-0">
              <p className="font-mono text-[1rem] font-black text-[#006241]">{studentNumber}번</p>
              <h1 className="section-title mt-1 text-[1.8rem] font-extrabold leading-none text-[#2F241D]">
                경매장
              </h1>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between gap-3 rounded-[1.15rem] border-2 border-[#9FC7B8] bg-[#EAF6F0] px-4 py-3">
            <div className="inline-flex items-center gap-3 text-[#006241]">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-white">
                <Coins size={20} />
              </span>
              <span className="text-[1rem] font-extrabold">내 화폐</span>
            </div>
            <span className="font-mono text-[1.8rem] font-black leading-none text-[#1F2523]">
              {isLoading ? '...' : formatCurrency(balance)}
            </span>
          </div>

          {statusMessage ? (
            <div className="mb-3 rounded-[1rem] border border-[#E6D5C9] bg-[#FFFDF8] px-4 py-2.5 text-center text-[0.9rem] font-extrabold text-[#006241]">
              {statusMessage}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {AUCTION_ITEMS.map((item) => {
              const currentBid = auctionBids[item.id] ?? { amount: 0, bidder: null };
              const isSelected = item.id === selectedItem.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={`min-h-[9.4rem] rounded-[1.2rem] border p-3 text-left shadow-[0_10px_22px_rgba(31,24,18,0.08)] transition-all ${
                    isSelected
                      ? 'border-[#006241] bg-[#EAF6F0] ring-2 ring-[#9FC7B8]'
                      : 'border-[#E8DDD0] bg-[#FFFDF8] hover:border-[#9FC7B8] hover:bg-[#F8FCF6]'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="section-title text-[1.08rem] font-extrabold leading-tight text-[#2F241D]">
                        {item.name}
                      </h2>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.75rem] bg-white text-[#006241]">
                      <Gavel size={17} />
                    </span>
                  </div>

                  <div className="flex min-h-[4.7rem] flex-col items-center justify-center gap-2 rounded-[1rem] border-2 border-[#D7E6DE] bg-white px-2 py-2.5">
                    <div className="font-mono text-[1.35rem] font-black leading-none text-[#006241]">
                      {formatCurrency(currentBid.amount)}
                    </div>
                    <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-[#006241] px-2.5 font-mono text-[0.78rem] font-black text-white">
                      {currentBid.bidder ? `${currentBid.bidder}번` : '0번'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedItem ? (() => {
            const currentBid = auctionBids[selectedItem.id] ?? { amount: 0, bidder: null };
            const minimumBid = getMinimumBid(selectedItem, currentBid.amount);
            const maxBid = clampBidAmount(balance);
            const selectedBidAmount = Math.max(minimumBid, clampBidAmount(bidAmounts[selectedItem.id] ?? minimumBid));
            const canSubmit =
              !isLoading &&
              isSubmittingItemId === null &&
              selectedBidAmount >= minimumBid &&
              selectedBidAmount <= maxBid;

            return (
              <div className="mt-4 rounded-[1.2rem] border-2 border-[#9FC7B8] bg-[#F8FCF6] p-3 shadow-[0_10px_22px_rgba(31,24,18,0.08)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="section-title min-w-0 text-[1.35rem] font-extrabold leading-tight text-[#2F241D]">
                    {selectedItem.name}
                  </h2>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[1.05rem] font-black text-[#006241]">
                      {formatCurrency(currentBid.amount)}
                    </span>
                    <span className="inline-flex h-7 items-center justify-center rounded-full bg-[#006241] px-2.5 font-mono text-[0.78rem] font-black text-white">
                      {currentBid.bidder ? `${currentBid.bidder}번` : '0번'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2 sm:grid-cols-[3.2rem_minmax(0,1fr)_3.2rem_10rem]">
                  <button
                    type="button"
                    onClick={() => setBidAmounts((previous) => ({
                      ...previous,
                      [selectedItem.id]: Math.max(minimumBid, selectedBidAmount - BID_STEP),
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
                      [selectedItem.id]: Math.min(maxBid, selectedBidAmount + BID_STEP),
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
        </section>
      </main>
    </div>
  );
}
