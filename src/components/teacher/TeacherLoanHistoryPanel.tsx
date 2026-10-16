import { Check, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { getKoreanLocalDateKey } from '../../lib/studentEmotion';
import { getTeacherLoanStatusLabel, type TeacherLoanReport } from '../../lib/teacherLoanHistory';
import { loadTeacherLoanHistory } from '../../lib/teacherLoanHistoryClient';
import type { StudentEconomyStates } from '../../lib/studentEconomy';
import StableLabel from '../StableLabel';

const amountFormat = new Intl.NumberFormat('ko-KR');
const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function TeacherLoanHistoryPanel({ states }: { readonly states: StudentEconomyStates }) {
  const id = useId(), statesRef = useRef(states), panelRef = useRef<HTMLElement>(null);
  statesRef.current = states;
  const [report, setReport] = useState<TeacherLoanReport | null>(null);
  const [selectedStudent, setSelectedStudent] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void loadTeacherLoanHistory(statesRef.current, controller.signal).then(next => {
      if (!controller.signal.aborted) setReport(next);
    }).catch(() => {
      if (!controller.signal.aborted) setError('대출 내역을 불러오지 못했습니다. 다시 불러오기를 눌러 주세요.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshVersion]);
  const status = report?.students.find(row => row.studentNumber === selectedStudent);
  const entries = report?.entries.filter(entry => entry.studentNumber === selectedStudent) ?? [];
  const today = getKoreanLocalDateKey();
  const selectedIsOverdue = status !== undefined && getTeacherLoanStatusLabel(status, today) === '연체';
  const borrowerCount = report?.students.filter(row => row.repaymentAmount > 0).length ?? 0;
  return <section ref={panelRef} tabIndex={-1} className="teacher-loan-panel" aria-labelledby={`${id}-title`} aria-busy={loading}>
    <header className="teacher-loan-header">
      <div><h3 id={`${id}-title`}>대출 내역</h3>{report ? <span>대출 중 {borrowerCount}명 · <time dateTime={report.checkedAt}>{timeFormat.format(new Date(report.checkedAt))} 조회</time></span> : null}</div>
      <button type="button" onClick={() => { panelRef.current?.focus({ preventScroll: true }); setRefreshVersion(value => value + 1); }} disabled={loading}><RefreshCw size={16} aria-hidden="true" /><StableLabel busy={loading} busyLabel="불러오는 중" label={'다시 불러오기'} /></button>
    </header>
    {error ? <p className="teacher-loan-error" role="alert">{error}{report ? ' 아래는 이전 조회 결과입니다.' : ''}</p> : null}
    {loading && !report ? <p role="status" className="teacher-loan-notice">대출 내역 확인 중…</p> : null}
    {report ? <>
      <div className="teacher-loan-workspace">
        <section className="teacher-loan-roster" aria-label="학생별 대출 현황">
          {report.students.map(row => <button key={row.studentNumber} type="button" aria-pressed={selectedStudent === row.studentNumber}
            aria-controls={`${id}-detail`} aria-label={`${row.studentNumber}번, ${getTeacherLoanStatusLabel(row, today) === '연체' ? '주의, ' : ''}${getTeacherLoanStatusLabel(row, today)}, 상환액 ${row.repaymentAmount}고마`}
            onClick={() => setSelectedStudent(row.studentNumber)}>
            <strong>{row.studentNumber}번{selectedStudent === row.studentNumber ? <Check size={14} aria-hidden="true" /> : null}</strong><span>{row.repaymentAmount > 0 ? `${amountFormat.format(row.repaymentAmount)}고마` : '대출 없음'}</span>
            {getTeacherLoanStatusLabel(row, today) === '연체' ? <small className="teacher-loan-warning"><TriangleAlert size={14} aria-hidden="true" />주의</small> : null}
          </button>)}
        </section>
        <section id={`${id}-detail`} className="teacher-loan-detail" aria-labelledby={`${id}-student`}>
          <header><h4 id={`${id}-student`} aria-live="polite">{selectedStudent}번 대출 내역</h4>{status ? <span className={selectedIsOverdue ? 'teacher-loan-warning' : undefined}>{selectedIsOverdue ? <><TriangleAlert size={16} aria-hidden="true" />주의 · 상환 기한 지남</> : getTeacherLoanStatusLabel(status, today)}</span> : null}</header>
          {status ? <dl className="teacher-loan-summary">
            <div><dt>남은 원금</dt><dd>{amountFormat.format(status.principal)}<small>고마</small></dd></div>
            <div><dt>이자 포함 상환액</dt><dd>{amountFormat.format(status.repaymentAmount)}<small>고마</small></dd></div>
            <div><dt>상환 기한</dt><dd>{status.dueDate ?? '—'}</dd></div>
          </dl> : null}
          {report.source === 'local' ? <p className="teacher-loan-notice">대출·상환 처리 기록은 서버 연결 후 확인할 수 있습니다.</p> : <>
            <p className="teacher-loan-notice">처리 기록이 남아 있는 대출·상환 내역만 표시합니다.</p>
            {entries.length === 0 ? <p className="teacher-loan-empty" role="status">확인 가능한 대출·상환 내역이 없습니다.</p> : <div className="teacher-loan-table" role="region" aria-label={`${selectedStudent}번 대출·상환 거래 ${entries.length}건`} tabIndex={0}>
              <table><caption className="sr-only">{selectedStudent}번 대출 수령·상환 {entries.length}건, 금액 단위 고마</caption>
                <thead><tr><th scope="col">일시</th><th scope="col">내역</th><th scope="col">금액</th><th scope="col">처리 후 상환액</th></tr></thead>
                <tbody>{entries.map(entry => <tr key={entry.id}>
                  <td><time dateTime={entry.createdAt}>{timeFormat.format(new Date(entry.createdAt))}</time></td>
                  <th scope="row">{entry.type === 'borrow' ? '대출 수령' : '대출 상환'}</th>
                  <td>{amountFormat.format(entry.amount)}</td><td>{amountFormat.format(entry.repaymentAfter)}</td>
                </tr>)}</tbody>
              </table>
            </div>}
          </>}
        </section>
      </div>
    </> : null}
  </section>;
}
