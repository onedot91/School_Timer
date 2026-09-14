import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { groupSaveFailureAlerts, isDelayedSaveFailure, SAVE_FAILURE_CODE_LABELS, SAVE_FAILURE_FEATURES, SAVE_FAILURE_POLL_MS, type SaveFailureAlert } from '../../lib/saveFailure';
import { acknowledgeAllSaveFailures, acknowledgeSaveFailure, loadSaveFailureAlerts, SAVE_FAILURE_CHANGE_EVENT } from '../../lib/saveFailureClient';
import { formatSaveFailureDiagnostic, getSaveFailureExplanation } from '../../lib/saveFailureDiagnostics';
import { useModalFocus } from '../../lib/useModalFocus';

function SaveFailureItem({ alert, savingId, onAcknowledge }: { alert: SaveFailureAlert; savingId: string | null; onAcknowledge: (alert: SaveFailureAlert) => Promise<void> }) {
  const [copyStatus, setCopyStatus] = useState('');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const target = alert.studentNumber === 0 ? '교사' : `${alert.studentNumber}번 학생`;
  const explanation = getSaveFailureExplanation(alert);
  const diagnostic = formatSaveFailureDiagnostic(alert);
  const copy = async () => {
    try { await navigator.clipboard.writeText(diagnostic); setCopyStatus('진단 정보를 복사했습니다.'); }
    catch {
      if (detailsRef.current) detailsRef.current.open = true;
      textRef.current?.focus(); textRef.current?.select();
      setCopyStatus('자동 복사를 사용할 수 없습니다. 선택된 진단 정보를 직접 복사하세요.');
    }
  };
  const delayed = isDelayedSaveFailure(alert);
  const past = Date.now() - Date.parse(alert.occurredAt) >= 30 * 60 * 1000;
  const timing = delayed ? '지연 접수' : past ? '이전 오류' : '최근 오류';
  return <li>
    <b className={`teacher-save-warning-timing${delayed || past ? ' is-past' : ''}`}>{timing}</b>
    <div><strong>{target} · {SAVE_FAILURE_FEATURES[alert.feature]}</strong>
      <span>{SAVE_FAILURE_CODE_LABELS[alert.code]} · 발생 <time dateTime={alert.occurredAt}>{new Date(alert.occurredAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></span>
    </div>
    {alert.receivedAt ? <small>접수 <time dateTime={alert.receivedAt}>{new Date(alert.receivedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></small> : null}
    {delayed ? <p>발생 후 5분 이상 지나 접수된 알림입니다.</p> : null}
    <p>{explanation.problem}</p>
    <p className="teacher-save-warning-action"><b>다음 조치</b> {explanation.action}</p>
    {!alert.diagnostics ? <small>이전 알림에는 상세 오류가 저장되지 않았습니다.</small> : null}
    <details ref={detailsRef}><summary>진단 정보</summary><textarea ref={textRef} readOnly rows={7} aria-label={`${target} ${SAVE_FAILURE_FEATURES[alert.feature]} 진단 정보`} value={diagnostic} /></details>
    <div className="teacher-save-warning-actions">
      <button type="button" onClick={() => void copy()}>진단 정보 복사</button>
      <button type="button" disabled={savingId !== null} onClick={() => void onAcknowledge(alert)} aria-label={`${target} ${SAVE_FAILURE_FEATURES[alert.feature]} 오류 확인 처리`}>{savingId === alert.id ? '저장 중' : '확인 처리'}</button>
    </div>
    {copyStatus ? <span role="status">{copyStatus}</span> : null}
  </li>;
}

export default function TeacherSaveFailureWarning({ returnFocusRef }: { returnFocusRef: RefObject<HTMLButtonElement | null> }) {
  const [alerts, setAlerts] = useState<SaveFailureAlert[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<(afterMutation?: boolean) => Promise<void>>(async () => undefined);
  const mutationVersion = useRef(0);
  useModalFocus({ dialogRef, isOpen, onDismiss: () => setIsOpen(false), returnFocusRef, isDismissible: savingId === null });

  useEffect(() => {
    let disposed = false;
    let loading: Promise<void> | null = null;
    const refresh = (afterMutation = false): Promise<void> => {
      if (afterMutation) {
        mutationVersion.current++;
        return (loading ?? Promise.resolve()).then(() => refresh());
      }
      if (loading) return loading;
      const version = mutationVersion.current;
      loading = (async () => {
        try {
          const result = await loadSaveFailureAlerts();
          if (!disposed && version === mutationVersion.current) { setAlerts(result.alerts); setHasMore(result.hasMore); setUnavailable(false); }
        } catch { if (!disposed && version === mutationVersion.current) setUnavailable(true); }
        finally { loading = null; }
      })();
      return loading;
    };
    refreshRef.current = refresh;
    const onChange = () => void refresh();
    onChange();
    const interval = window.setInterval(onChange, SAVE_FAILURE_POLL_MS);
    window.addEventListener(SAVE_FAILURE_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    window.addEventListener('online', onChange);
    window.addEventListener('focus', onChange);
    return () => {
      disposed = true; window.clearInterval(interval);
      window.removeEventListener(SAVE_FAILURE_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
      window.removeEventListener('online', onChange);
      window.removeEventListener('focus', onChange);
    };
  }, []);

  const acknowledge = async (alert: SaveFailureAlert) => {
    setSavingId(alert.id); setError(''); setConfirmedCount(null); setConfirmAll(false);
    mutationVersion.current++;
    try {
      await acknowledgeSaveFailure(alert);
      setAlerts((current) => current.filter((item) => item.id !== alert.id || item.studentNumber !== alert.studentNumber));
    } catch { setError('확인 처리를 저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { await refreshRef.current(true); setSavingId(null); dialogRef.current?.focus({ preventScroll: true }); }
  };
  const acknowledgeAll = async () => {
    setSavingId('all'); setError(''); setConfirmedCount(0); setConfirmAll(false);
    mutationVersion.current++;
    try { await acknowledgeAllSaveFailures(setConfirmedCount); }
    catch { setError('일괄 확인이 중단되었습니다. 남은 알림을 다시 확인 처리해 주세요.'); }
    finally { await refreshRef.current(true); setSavingId(null); dialogRef.current?.focus({ preventScroll: true }); }
  };
  const groups = groupSaveFailureAlerts(alerts);
  const warning = alerts.length > 0 || unavailable;
  const label = alerts.length > 0 ? `저장 오류 ${alerts.length}${hasMore ? '+' : ''}건` : '저장 오류 확인 불가';
  return <>
    {warning ? <span className="teacher-save-warning" role="alert">
      <button type="button" ref={triggerRef} className="teacher-save-warning-trigger" onClick={() => { setConfirmedCount(null); setError(''); setConfirmAll(false); setIsOpen(true); }} aria-label={label} title={label} aria-haspopup="dialog">
        <AlertTriangle size={19} aria-hidden="true" /><span>저장 오류</span>{alerts.length > 0 ? <b>{groups.length}{hasMore ? '+' : ''}</b> : null}
      </button>
    </span> : null}
    {isOpen && createPortal(<div className="teacher-save-warning-backdrop teacher-settings-theme" onClick={() => { if (!savingId) setIsOpen(false); }}>
      <div ref={dialogRef} tabIndex={-1} className="teacher-save-warning-dialog" role="dialog" aria-modal="true" aria-labelledby="save-warning-title" onClick={(event) => event.stopPropagation()}>
        <header><h2 id="save-warning-title"><AlertTriangle size={22} aria-hidden="true" /> 저장 오류</h2><button type="button" aria-label="저장 오류 닫기" disabled={savingId !== null} onClick={() => setIsOpen(false)}><X size={22} /></button></header>
        {alerts.length > 0 ? <div className="teacher-save-warning-bulk">
          <p>{alerts.length}{hasMore ? '+' : ''}건 · 반복 오류는 묶어 표시합니다.</p>
          <button type="button" disabled={savingId !== null} onClick={() => setConfirmAll(true)}>모두 확인 처리</button>
        </div> : null}
        {confirmAll ? <div className="teacher-save-warning-bulk">
          <p>모든 알림을 확인 처리합니다. 기록을 복구하거나 다시 저장하지 않습니다.</p>
          <div><button type="button" onClick={() => void acknowledgeAll()}>일괄 확인</button><button type="button" onClick={() => setConfirmAll(false)}>취소</button></div>
        </div> : null}
        {confirmedCount !== null ? <p role="status">{confirmedCount}건 확인 처리{savingId === 'all' ? ' 중…' : '됨'}</p> : null}
        {unavailable ? <p className="teacher-save-warning-error" role="alert">오류 알림을 조회하지 못했습니다. 연결 상태를 확인해 주세요. <button type="button" onClick={() => void refreshRef.current()}>다시 조회</button></p> : null}
        {error ? <p className="teacher-save-warning-error" role="alert">{error}</p> : null}
        <ul className="teacher-save-warning-list">
          {groups.map((group) => group.length === 1
            ? <SaveFailureItem key={`${group[0].studentNumber}-${group[0].id}`} alert={group[0]} savingId={savingId} onAcknowledge={acknowledge} />
            : <li key={`${group[0].studentNumber}-${group[0].id}`}><details><summary>
              {group[0].studentNumber === 0 ? '교사' : `${group[0].studentNumber}번 학생`} · {SAVE_FAILURE_FEATURES[group[0].feature]} · 같은 오류 {group.length}건
            </summary><ul>{group.map(alert => <SaveFailureItem key={alert.id} alert={alert} savingId={savingId} onAcknowledge={acknowledge} />)}</ul></details></li>)}
        </ul>
        {!warning ? <p role="status">미확인 저장 오류가 없습니다.</p> : null}
        {alerts.length > 0 ? <small>확인 처리는 기록 복구가 아닙니다.</small> : null}
      </div>
    </div>, document.body)}
  </>;
}
