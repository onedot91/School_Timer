import { ClipboardCheck, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { REWARD_AUDIT_FEATURES, type RewardAuditReport } from '../../lib/rewardAudit';
import { loadRewardAuditReport } from '../../lib/rewardAuditClient';
import { REWARD_AUDIT_INTERVAL_MS, startRewardAuditPolling } from '../../lib/rewardAuditPolling';
import { useModalFocus } from '../../lib/useModalFocus';

export default function TeacherRewardAudit() {
  const [report, setReport] = useState<RewardAuditReport | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [student, setStudent] = useState('all');
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const manualRequest = useRef<AbortController | null>(null);
  const refreshRef = useRef<(signal: AbortSignal) => Promise<void>>(async () => undefined);
  useModalFocus({ dialogRef, isOpen, onDismiss: () => setIsOpen(false), returnFocusRef });
  useEffect(() => {
    let disposed = false, revision = 0;
    let activeRequest: AbortSignal | null = null;
    const refresh = async (signal: AbortSignal) => {
      if (activeRequest && !activeRequest.aborted) return;
      activeRequest = signal;
      const current = ++revision; setLoading(true);
      try {
        const next = await loadRewardAuditReport(signal);
        if (!disposed && !signal.aborted && current === revision) { setReport(next); setError(''); }
      } catch {
        if (!disposed && !signal.aborted && current === revision) setError('보상 기록을 조회하지 못했습니다. 다시 검사해 주세요.');
      } finally { if (activeRequest === signal) activeRequest = null; if (!disposed && current === revision) setLoading(false); }
    };
    refreshRef.current = refresh;
    const stop = startRewardAuditPolling({ refresh, visible: () => document.visibilityState === 'visible', events: window, visibilityEvents: document,
      schedule: tick => { const timer = window.setInterval(tick, REWARD_AUDIT_INTERVAL_MS); return () => window.clearInterval(timer); }, now: Date.now });
    return () => { disposed = true; stop(); manualRequest.current?.abort(); };
  }, []);
  const count = (report?.issues.length ?? 0) + (report?.walletMismatches.length ?? 0);
  const issues = (report?.issues ?? []).filter(issue => student === 'all' || String(issue.studentNumber) === student);
  const wallets = (report?.walletMismatches ?? []).filter(item => student === 'all' || String(item.studentNumber) === student);
  const refresh = () => { manualRequest.current?.abort(); const request = new AbortController(); manualRequest.current = request; void refreshRef.current(request.signal); };
  if (count === 0 && !error && !isOpen) return null;
  return <>
    <button ref={returnFocusRef} className="teacher-save-warning-trigger teacher-reward-audit-trigger" data-warning={count > 0 || !!error} type="button" onClick={() => setIsOpen(true)} aria-haspopup="dialog" aria-label={count > 0 ? `보상 점검 확인 필요 ${count}건` : '보상 점검'}>
      <ClipboardCheck size={18} aria-hidden="true" /><span>보상 점검</span>{count > 0 ? <b>{count}</b> : null}{error ? <span>!</span> : null}
    </button>
    {isOpen && createPortal(<div className="teacher-save-warning-backdrop teacher-settings-theme" onClick={() => setIsOpen(false)}>
      <div ref={dialogRef} tabIndex={-1} className="teacher-save-warning-dialog teacher-reward-audit-dialog" role="dialog" aria-modal="true" aria-labelledby="reward-audit-title" onClick={event => event.stopPropagation()}>
        <header><h2 id="reward-audit-title">보상 점검</h2><button type="button" aria-label="보상 점검 닫기" onClick={() => setIsOpen(false)}><X /></button></header>
        <div className="teacher-reward-audit-toolbar">
          <label>학생 <select value={student} onChange={event => setStudent(event.target.value)}><option value="all">전체</option>{Array.from({ length: 23 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}번</option>)}</select></label>
          <button type="button" onClick={refresh} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? '검사 중' : '다시 검사'}</button>
        </div>
        {error ? <p role="alert" className="teacher-save-warning-error">{error}{report ? ' 아래는 이전 검사 결과입니다.' : ''}</p> : null}
        {!report && !error ? <p role="status">보상 기록 확인 중</p> : null}
        {report ? <>
          <p><time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</time> · {report.checkedRewards}건 대조</p>
          {issues.length + wallets.length > 0 ? <p>지급 내역 확인이 필요합니다. 별도 복구 내역을 확인한 뒤 판단해 주세요.</p> : <p role="status">{student === 'all' ? '' : `${student}번 학생의 `}확인 가능한 기록에서 누락 의심 건이 없습니다.</p>}
          <ul className="teacher-save-warning-list">
            {wallets.map(item => <li key={`wallet-${item.studentNumber}`}><strong>{item.studentNumber}번 · 잔액 불일치</strong><p>보유 {item.balance}고마 · 원장 계산 {item.expectedBalance}고마</p></li>)}
            {issues.slice(0, 100).map(issue => <li key={`${issue.studentNumber}:${issue.id}`}><strong>{issue.studentNumber}번 · {REWARD_AUDIT_FEATURES[issue.feature]}</strong><span>{issue.dateKey} · {issue.kind === 'missing' ? '지급 내역 확인 필요' : '지급액 확인 필요'}</span><p>예상 {issue.expectedAmount === null ? '금액 확인 필요' : `${issue.expectedAmount}고마`} · 연결된 지급 {issue.paidAmount}고마</p></li>)}
          </ul>
          {issues.length > 100 ? <p>{issues.length}건 중 100건 표시 · 학생을 선택해 확인하세요.</p> : null}
          {report.unavailableSources.length > 0 ? <details className="teacher-reward-audit-coverage"><summary>검사 범위와 확인 불가 항목</summary><ul>{report.unavailableSources.map(source => <li key={source}>{source}</li>)}</ul></details> : null}
        </> : null}
      </div>
    </div>, document.body)}
  </>;
}
