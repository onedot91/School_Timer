import { useId, useState } from 'react';
import {
  STUDENT_STOCKS,
  type StudentEconomyState,
  type StudentEconomyStates,
  type StudentStockMarket,
} from '../../lib/studentEconomy';

export const getTeacherInvestmentSummary = (state: StudentEconomyState | undefined) => {
  const positions = STUDENT_STOCKS.flatMap(stock => {
    const position = state?.investments[stock.id];
    return position ? [position] : [];
  });
  const invested = positions.reduce((sum, position) => sum + position.investedAmount, 0);
  const current = positions.reduce((sum, position) => sum + position.currentAmount, 0);
  const profit = current - invested;
  return {
    count: positions.length,
    invested,
    current,
    profit,
    percent: invested > 0 ? profit / invested * 100 : 0,
    trend: profit > 0 ? 'up' : profit < 0 ? 'down' : 'flat',
  };
};

const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const formatAmount = (value: number) => numberFormat.format(value);
const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${formatAmount(value)}`;
const trendSymbol = (value: number) => value > 0 ? '▲' : value < 0 ? '▼' : '─';

export default function TeacherInvestmentStatus({ states, market }: {
  readonly states: StudentEconomyStates;
  readonly market: StudentStockMarket;
}) {
  const [selectedStudent, setSelectedStudent] = useState(1);
  const id = useId();
  const state = states[String(selectedStudent)];
  const summary = getTeacherInvestmentSummary(state);

  return <div className="teacher-investment-dashboard">
    <section className="teacher-investment-overview" aria-labelledby={`${id}-overview`}>
      <header><h4 id={`${id}-overview`}>전체 학생 등락</h4><span>원금 대비 누적 손익</span></header>
      <div className="teacher-investment-legend" aria-label="등락 색상 기준">
        <span className="is-up">▲ 수익</span><span className="is-flat">─ 변동 없음</span><span className="is-down">▼ 손실</span>
      </div>
      <div className="teacher-investment-roster" role="group" aria-label="학생별 누적 손익">
        {Array.from({ length: 23 }, (_, index) => index + 1).map(studentNumber => {
          const student = getTeacherInvestmentSummary(states[String(studentNumber)]);
          const status = student.count === 0 ? '투자 없음' : student.profit === 0 ? '변동 없음'
            : `${student.profit > 0 ? '수익' : '손실'} ${formatAmount(Math.abs(student.profit))} 고마`;
          return <button key={studentNumber} type="button" className={`is-${student.trend}`} aria-label={`${studentNumber}번, ${status}`} title={`${studentNumber}번 · ${status}`} aria-pressed={selectedStudent === studentNumber} aria-controls={`${id}-detail`} data-invested={student.count > 0} onClick={() => setSelectedStudent(studentNumber)}>
            <strong>{studentNumber}</strong><span aria-hidden="true">{student.count === 0 ? '미투자' : trendSymbol(student.profit)}</span>
          </button>;
        })}
      </div>
    </section>
    <section className="teacher-investment-detail" id={`${id}-detail`} aria-labelledby={`${id}-detail-title`} tabIndex={0}>
      <header><h4 id={`${id}-detail-title`} aria-live="polite">{selectedStudent}번 세부 투자 현황</h4><span>{summary.count}종목 · 고마</span></header>
      <dl className="teacher-investment-totals">
        <div><dt>투자 원금</dt><dd>{formatAmount(summary.invested)}</dd></div>
        <div><dt>현재 금액</dt><dd>{formatAmount(summary.current)}</dd></div>
        <div className={`is-${summary.trend}`}><dt>누적 손익</dt><dd>{formatSigned(summary.profit)}<small>{formatSigned(summary.percent)}%</small></dd></div>
      </dl>
      {summary.count === 0 ? <p className="teacher-investment-empty">투자 중인 종목이 없습니다.</p> : <div className="teacher-investment-breakdown" role="region" tabIndex={0} aria-label={`${selectedStudent}번 종목별 투자 내역`}>
        <table>
          <thead><tr><th scope="col">종목</th><th scope="col">원금</th><th scope="col">현재</th><th scope="col">누적 손익</th></tr></thead>
          <tbody>{STUDENT_STOCKS.map(stock => {
            const position = state?.investments[stock.id];
            const profit = position ? position.currentAmount - position.investedAmount : 0;
            const comment = position ? market[stock.id]?.find(entry => entry.dateKey === position.lastSettledDateKey)?.comment : '';
            return <tr key={stock.id}>
              <th scope="row"><strong><span aria-hidden="true">{stock.emoji}</span> {stock.name}</strong>
                {position ? <small>{position.lastSettledDateKey} 반영<br />마지막 등락 {formatSigned(position.lastChangeAmount)} 고마{comment ? <><br />{comment}</> : null}</small> : <small>미투자</small>}
              </th>
              <td>{position ? formatAmount(position.investedAmount) : '—'}</td>
              <td>{position ? formatAmount(position.currentAmount) : '—'}</td>
              <td className={`is-${profit > 0 ? 'up' : profit < 0 ? 'down' : 'flat'}`}>{position ? <>{formatSigned(profit)}<small>{formatSigned(position.investedAmount > 0 ? profit / position.investedAmount * 100 : 0)}%</small></> : '—'}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </section>
  </div>;
}
