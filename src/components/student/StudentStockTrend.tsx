import type { StudentStockId } from '../../lib/studentEconomy';

const STOCK_PROFILE_IMAGES = {
  sunny: '/stock-profiles/nyamnyam-food.png',
  sprout: '/stock-profiles/pangpang-games.png',
  cloud: '/stock-profiles/cheokcheok-tech.png',
  star: '/stock-profiles/banjjak-entertainment.png',
} as const satisfies Record<StudentStockId, string>;

const STOCK_PROFILE_LABELS = {
  sunny: '냠냠푸드 프로필',
  sprout: '팡팡게임즈 프로필',
  cloud: '척척테크 프로필',
  star: '반짝엔터 프로필',
} as const satisfies Record<StudentStockId, string>;

export function StudentStockIcon({ stockId }: { stockId: StudentStockId }) {
  return (
    <span className="student-stock-icon">
      <img
        src={STOCK_PROFILE_IMAGES[stockId]}
        alt={STOCK_PROFILE_LABELS[stockId]}
        width="192"
        height="192"
        draggable={false}
      />
    </span>
  );
}

export function StudentStockTrend({ amount, label = '오늘' }: { amount: number; label?: string }) {
  const trend = amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat';
  const symbol = amount > 0 ? '▲' : amount < 0 ? '▼' : '－';
  const spokenValue = amount > 0 ? `${amount} 고마 올랐어요` : amount < 0 ? `${Math.abs(amount)} 고마 내렸어요` : '변화가 없어요';

  return (
    <span className={`student-stock-trend is-${trend}`} aria-label={`${label} ${spokenValue}`}>
      <span aria-hidden="true">{symbol}</span>
      <strong>{Math.abs(amount)} 고마</strong>
    </span>
  );
}
