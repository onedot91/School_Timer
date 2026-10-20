import { ChevronDown } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { CURRENCY_UNIT_LABEL, formatCurrencyAmount, type CurrencyBalances, type CurrencyHistory } from '../../lib/currency';
import type { StudentEconomyStates } from '../../lib/studentEconomy';
import { summarizeCurrencyDay, type CurrencyDayReason, type CurrencyDayReasonTotal } from '../../lib/currencyDaySummary';
import SettingsPanelFrame from './SettingsPanelFrame';

const reasonLabels: Record<CurrencyDayReason, string> = {
  teacher_adjust: '교사 조정',
  bank_interest: '이자',
  investment_return: '투자 손익',
  student_transfer: '송금',
  reset: '초기화',
  tax: '세금',
  allowance: '기본 지급',
  auction_award: '경매 낙찰',
  weekly_mission: '주간 미션',
  daily_emotion: '감정 기록',
  weekly_emotion: '감정 주간 보상',
  sudoku_mission: '스도쿠 보상',
  number_baseball_mission: '숫자야구 보상',
  classroom_role: '역할 차감',
  daily_writing: '글쓰기 보상',
  class_donation: '기부',
  pet_feed: '먹이 구매',
  shop_purchase: '상점 구매',
  house_creator_reward: '집 판매 보상',
  stock_trade: '주식 거래',
};

const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
const REASON_LIMIT = 5;
const ratio = (value: number, max: number) => (max > 0 ? Math.min(1, Math.max(0, value) / max) : 0);

function ReasonBars({ title, tone, reasons }: { readonly title: string; readonly tone: 'in' | 'out'; readonly reasons: readonly CurrencyDayReasonTotal[] }) {
  const shown = reasons.length > REASON_LIMIT ? reasons.slice(0, REASON_LIMIT - 1) : reasons;
  const rest = reasons.slice(shown.length);
  const rows = rest.length > 0
    ? [...shown.map((row) => ({ key: row.reason, label: reasonLabels[row.reason], amount: row.amount })),
      { key: 'other', label: '기타', amount: rest.reduce((total, row) => total + row.amount, 0) }]
    : shown.map((row) => ({ key: row.reason, label: reasonLabels[row.reason], amount: row.amount }));
  const max = rows.reduce((value, row) => Math.max(value, row.amount), 0);
  const sign = tone === 'in' ? '+' : '−';
  return (
    <section className="teacher-currency-reasons-group" data-tone={tone} aria-label={`${title} 사유`}>
      <h4>{title}</h4>
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => (
            <li key={row.key} title={`${row.label} ${sign}${formatCurrencyAmount(row.amount)}`}>
              <span className="teacher-currency-reason-label">{row.label}</span>
              <span className="teacher-currency-reason-track" aria-hidden="true">
                <span style={{ '--bar': ratio(row.amount, max) } as CSSProperties} />
              </span>
              <strong>{sign}{formatCurrencyAmount(row.amount)}</strong>
            </li>
          ))}
        </ul>
      ) : <p className="teacher-currency-empty">없음</p>}
    </section>
  );
}

interface TeacherCurrencyHistoryPanelProps {
  readonly history: CurrencyHistory;
  readonly balances: CurrencyBalances;
  readonly economyStates: StudentEconomyStates;
  readonly dayStart: number;
}

export default function TeacherCurrencyHistoryPanel({ history, balances, economyStates, dayStart }: TeacherCurrencyHistoryPanelProps) {
  const summary = useMemo(
    () => summarizeCurrencyDay(history, balances, economyStates, dayStart, dayStart + 24 * 60 * 60 * 1000),
    [history, balances, economyStates, dayStart],
  );
  return (
    <SettingsPanelFrame
      label="입출금"
      status={(
        <>
          <h3 className="section-title">오늘 입출금</h3>
        </>
      )}
    >
      <div className="teacher-currency-panel">
        <section className="teacher-currency-holdings" aria-labelledby="teacher-currency-holdings-title">
          <h4 id="teacher-currency-holdings-title">보유 {CURRENCY_UNIT_LABEL}</h4>
          <ol>
            {summary.students.map((student) => (
              <li key={student.studentNumber} title={`${student.studentNumber}번 보유 ${formatCurrencyAmount(student.balance)}${CURRENCY_UNIT_LABEL}`}>
                <strong data-tone={student.balance < 0 ? 'out' : undefined}>
                  <span className="sr-only">{student.studentNumber}번 </span>{formatCurrencyAmount(student.balance)}
                </strong>
                <span className="teacher-currency-holdings-bar" aria-hidden="true">
                  <span style={{ '--bar': ratio(student.balance, summary.maxBalance) } as CSSProperties} />
                </span>
                <span aria-hidden="true">{student.studentNumber}</span>
              </li>
            ))}
          </ol>
        </section>

        <dl className="teacher-currency-totals">
          <div data-tone="in"><dt>들어옴</dt><dd>+{formatCurrencyAmount(summary.incoming)}</dd></div>
          <div data-tone="out"><dt>나감</dt><dd>−{formatCurrencyAmount(summary.outgoing)}</dd></div>
          <div><dt>학급 보유</dt><dd>{formatCurrencyAmount(summary.totalBalance)}<small>{CURRENCY_UNIT_LABEL}</small></dd></div>
        </dl>

        {summary.entryCount > 0 ? (
          <div className="teacher-currency-reasons">
            <ReasonBars title="들어옴" tone="in" reasons={summary.incomingReasons} />
            <ReasonBars title="나감" tone="out" reasons={summary.outgoingReasons} />
          </div>
        ) : null}

        <section className="teacher-currency-students" aria-label="학생별 보유 고마와 오늘 입출금">
          <div className="teacher-currency-columns-wrap" aria-hidden="true">
            {[0, 1].map((column) => (
              <div key={column} className="teacher-currency-columns">
                <span>번호</span><span>보유</span><span className="teacher-currency-columns-flow"><span>−</span><span>+</span></span><span>오늘</span>
              </div>
            ))}
          </div>
          <ol>
            {summary.students.map((student) => {
              const netLabel = `${student.net > 0 ? '+' : student.net < 0 ? '−' : ''}${formatCurrencyAmount(Math.abs(student.net))}`;
              const netTone = student.net > 0 ? 'in' : student.net < 0 ? 'out' : undefined;
              const flowTitle = `${student.studentNumber}번 보유 ${formatCurrencyAmount(student.balance)}${CURRENCY_UNIT_LABEL}, 오늘 ${netLabel}`;
              const row = (
                <>
                  <strong className="teacher-currency-student-number">{student.studentNumber}번</strong>
                  <span className="teacher-currency-balance" title={`지갑 ${formatCurrencyAmount(student.wallet)} · 예금·투자 ${formatCurrencyAmount(student.savedAmount)}${student.loanPrincipal > 0 ? ` · 대출 −${formatCurrencyAmount(student.loanPrincipal)}` : ''}`}>
                    <span className="sr-only">보유 </span>{formatCurrencyAmount(student.balance)}
                    <span className="teacher-currency-balance-track" aria-hidden="true">
                      <span style={{ '--bar': ratio(student.balance, summary.maxBalance) } as CSSProperties} />
                    </span>
                  </span>
                  <span className="teacher-currency-flow" aria-hidden="true">
                    <span className="teacher-currency-flow-out" style={{ '--bar': ratio(Math.max(-student.net, 0), summary.maxStudentNet) } as CSSProperties} />
                    <span className="teacher-currency-flow-in" style={{ '--bar': ratio(Math.max(student.net, 0), summary.maxStudentNet) } as CSSProperties} />
                  </span>
                  <span className="teacher-currency-flow-amounts" data-tone={netTone}><span className="sr-only">오늘 </span>{netLabel}</span>
                </>
              );
              return (
                <li key={student.studentNumber}>
                  {student.entries.length > 0 ? (
                    <details className="teacher-currency-student">
                      <summary title={flowTitle}>
                        {row}
                        <ChevronDown size={16} className="teacher-currency-chevron" aria-hidden="true" />
                      </summary>
                      <ol className="teacher-currency-entries" aria-label={`${student.studentNumber}번 오늘 기록`}>
                        {student.entries.map((entry) => (
                          <li key={entry.id}>
                            <time dateTime={entry.createdAt}>{timeFormat.format(new Date(entry.createdAt))}</time>
                            <span className="teacher-currency-entry-reason">{reasonLabels[entry.reason]}</span>
                            <strong data-tone={entry.delta > 0 ? 'in' : entry.delta < 0 ? 'out' : undefined}>{entry.delta > 0 ? '+' : entry.delta < 0 ? '−' : ''}{formatCurrencyAmount(Math.abs(entry.delta))}</strong>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : (
                    <div className="teacher-currency-student" title={flowTitle}>
                      <div className="teacher-currency-student-row">{row}<span className="teacher-currency-chevron" /></div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </SettingsPanelFrame>
  );
}
