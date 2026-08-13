import { Cloud, Sprout, Star, Sun, type LucideIcon } from 'lucide-react';
import type { StudentStockId } from '../../lib/studentEconomy';

const STOCK_ICONS: Record<StudentStockId, LucideIcon> = {
  sunny: Sun,
  sprout: Sprout,
  cloud: Cloud,
  star: Star,
};

export function StudentStockIcon({ stockId }: { stockId: StudentStockId }) {
  const Icon = STOCK_ICONS[stockId];
  return <span className="student-stock-icon" aria-hidden="true"><Icon /></span>;
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
