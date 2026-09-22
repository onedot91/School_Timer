import { RefreshCw, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { dismissStorageAvailabilityNotice, getStorageAvailabilityNotice, subscribeStorageAvailability } from '../lib/storageAvailability';
import { canReloadWithDrafts, getUnsafeDraftRecoveryText, subscribeDraftReloadSafety, getDraftReloadSafetySnapshot } from '../lib/draftReloadSafety';
import { subscribeSaveRecovery, getSaveRecoverySnapshot, getSaveRecoveryStatus, requestSaveRecovery, isReviewedRecoveryIssue, type SaveRecoveryIssue } from '../lib/saveRecovery';
import { SAVE_FAILURE_FEATURES } from '../lib/saveFailure';

const recoveryReasons = {
  confirmation: '저장 결과가 아직 확인되지 않았어요. 해당 기능에서 기록을 확인해 주세요.',
  context: '저장 당시 조건을 확인해야 해요. 선생님과 기록을 확인해 주세요.',
  error: '확인 요청에 실패했어요. 잠시 후 다시 확인해 주세요.',
  waiting: '서버가 요청한 재시도 대기 시간이에요. 잠시 후 다시 확인해 주세요.',
};

export function StorageAvailabilityBanner({ actor, compact = false, onSettingsConflict }: {
  readonly actor: number | null;
  readonly compact?: boolean;
  readonly onSettingsConflict?: (error: unknown) => void;
}) {
  const notice = useSyncExternalStore(subscribeStorageAvailability, getStorageAvailabilityNotice, () => null);
  useSyncExternalStore(subscribeDraftReloadSafety, getDraftReloadSafetySnapshot, () => 0);
  useSyncExternalStore(subscribeSaveRecovery, getSaveRecoverySnapshot, () => 0);
  const unsafe = actor !== null && !canReloadWithDrafts(actor);
  const [showUnsafe, setShowUnsafe] = useState(false);
  const [copyFallback, setCopyFallback] = useState('');
  useEffect(() => {
    if (!unsafe) { setShowUnsafe(false); setCopyFallback(''); return; }
    const timer = window.setTimeout(() => setShowUnsafe(true), 500);
    return () => window.clearTimeout(timer);
  }, [unsafe, actor]);
  const recovery = actor === null ? null : getSaveRecoveryStatus(actor);
  const needsRecovery = compact && !!recovery && (recovery.pending > 0 || recovery.refreshPending || recovery.recovering);
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const activeIssues = recovery?.issues.filter(issue => !isReviewedRecoveryIssue(issue)) ?? [];
  const reviewedIssues = recovery?.issues.filter(isReviewedRecoveryIssue) ?? [];
  useEffect(() => { setRetryError(''); setReviewTarget(null); }, [actor]);
  useEffect(() => { if (recovery?.pending === 0) setRetryError(''); }, [recovery?.pending]);
  const recoveryDetailsRef = useRef<HTMLDetailsElement>(null);
  const indicatorRef = useRef<HTMLDetailsElement>(null);
  const [reloadBlocked, setReloadBlocked] = useState(false);
  const [dialog, setDialog] = useState<Element | null>(null);
  useLayoutEffect(() => {
    if (compact) return;
    if ((!notice || notice.actor !== actor) && !showUnsafe && !needsRecovery) return;
    const update = () => {
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      const owner = dialogs.item(dialogs.length - 1);
      setDialog(owner?.querySelector('.settings-parent-content') ?? owner ?? null);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-modal'] });
    return () => observer.disconnect();
  }, [notice, actor, showUnsafe, needsRecovery, compact]);
  if ((!notice || notice.actor !== actor) && !showUnsafe && !needsRecovery) return null;
  const reload = () => {
    if (actor !== null && !canReloadWithDrafts(actor)) { setReloadBlocked(true); return; }
    window.location.reload();
  };
  const copy = async () => {
      if (actor === null) return;
      try { await navigator.clipboard.writeText(getUnsafeDraftRecoveryText(actor)); setCopied(true); }
      catch { setCopyFallback(getUnsafeDraftRecoveryText(actor)); }
  };
  const copyButton = <button type="button" onClick={() => void copy()}>{copied ? '복사됨' : '내용 복사'}</button>;
  const retry = async () => {
    if (actor === null || isRetrying) return;
    setIsRetrying(true);
    setRetryError('');
    let describeError = (_error: unknown) => '확인을 완료하지 못했습니다. 잠시 후 다시 확인해 주세요.';
    try {
      const client = actor === 0 ? await import('../lib/teacherStorageClient') : null;
      if (client) describeError = client.teacherSettingsSaveErrorMessage;
      const result = client ? await client.recheckTeacherSaveResults() : await requestSaveRecovery(actor);
      if (result.pending > 0 && getSaveRecoveryStatus(actor).issues.some(issue => !isReviewedRecoveryIssue(issue))) {
        setRetryError('서버 확인 결과는 아래 항목에 표시됩니다.');
      }
    } catch (error) {
      if (actor === 0 && error instanceof Error && Reflect.get(error, 'serverCode') === 'TEACHER_SETTING_CONFLICT'
        && Reflect.get(error, 'status') === 409 && Reflect.get(error, 'uncertainWrite') !== true) {
        onSettingsConflict?.(error);
        setRetryError('다른 설정과 충돌했습니다. 설정창에서 보관된 변경 내용을 확인해 주세요.');
      } else setRetryError(describeError(error));
    } finally {
      if (recoveryDetailsRef.current) recoveryDetailsRef.current.open = true;
      setIsRetrying(false);
    }
  };
  const review = async (requestId: string) => {
    if (actor !== 0 || reviewing || isRetrying) return;
    setReviewing(true);
    setRetryError('');
    try {
      const { reviewTeacherTransaction } = await import('../lib/teacherStorageClient');
      await reviewTeacherTransaction(requestId);
      setReviewTarget(null);
      indicatorRef.current?.querySelector('summary')?.focus();
    } catch {
      setRetryError('알림 확인 처리를 완료하지 못했습니다. 다시 시도해 주세요.');
    } finally { setReviewing(false); }
  };
  const issueDetails = (issue: SaveRecoveryIssue, index: number) => {
    const transaction = actor === 0 ? issue.transaction : undefined;
    const labels = { adjust: '고마 지급·차감', deduct: '고마 차감', set: '잔액 설정', reset: '잔액 초기화' };
    return <li key={transaction?.requestId ?? index}>
      <b>{transaction ? labels[transaction.kind] : SAVE_FAILURE_FEATURES[issue.feature]}</b>{issue.httpStatus ? ` · HTTP ${issue.httpStatus}` : ''}
      {transaction ? <>
        <p>{new Date(transaction.createdAt).toLocaleString('ko-KR')}</p>
        <p>{transaction.kind === 'reset' || transaction.studentNumbers.length === 23 ? '전체 학생'
          : transaction.studentNumbers.length ? `${transaction.studentNumbers.join(', ')}번` : '대상 확인 필요'}
          {transaction.amount !== undefined ? ` · ${transaction.kind === 'set' ? '설정 잔액 ' : '1인당 '}${transaction.amount.toLocaleString('ko-KR')} 고마` : ''}</p>
        <details><summary>요청 번호</summary><code className="break-all">{transaction.requestId}</code></details>
      </> : null}
      <p>{isReviewedRecoveryIssue(issue) ? '교사 확인 · 서버 결과 미확인' : recoveryReasons[issue.reason]}</p>
      {transaction && issue.reason === 'confirmation' && !transaction.reviewedAt ? reviewTarget === transaction.requestId ? <div>
        <p>거래 내역을 직접 확인했나요? 알림만 확인 처리하며 저장 성공으로 처리하지 않습니다.</p>
        <button type="button" disabled={reviewing || isRetrying} onClick={() => void review(transaction.requestId)}>{reviewing ? '처리 중…' : '내역 확인했음'}</button>
        <button type="button" disabled={reviewing} onClick={() => setReviewTarget(null)}>취소</button>
      </div> : <button type="button" disabled={reviewing || isRetrying} onClick={() => setReviewTarget(transaction.requestId)}>알림 확인 처리</button> : null}
    </li>;
  };
  const fallback = copyFallback ? <textarea aria-label="보관하지 못한 내용" readOnly value={copyFallback} onFocus={event => event.currentTarget.select()} className="max-h-28 min-w-0 p-2" /> : null;
  const recoveryDetails = recovery && recovery.pending > 0 && recovery.issues.length > 0 ? <>
    {activeIssues.length > 0 ? (
    <details ref={recoveryDetailsRef} className="mt-1 text-sm">
      <summary className="min-h-11 cursor-pointer content-center py-2">미확인 {activeIssues.length}건 · 상세 보기</summary>
      <ul className="space-y-3 py-1" aria-label="저장 확인이 필요한 항목">
        {activeIssues.map(issueDetails)}
      </ul>
    </details>
    ) : null}
    {reviewedIssues.length > 0 ? <details className="mt-1 text-sm">
      <summary>확인 처리한 알림 {reviewedIssues.length}건</summary>
      <ul className="space-y-3 py-1" aria-label="교사가 확인 처리한 알림">{reviewedIssues.map(issueDetails)}</ul>
    </details> : null}
  </> : null;
  if (compact) {
    const activeNotice = notice?.actor === actor ? notice : null;
    const onlyReviewed = !unsafe && !activeNotice && !recovery?.refreshPending && activeIssues.length === 0 && reviewedIssues.length > 0;
    const label = unsafe ? '보관 오류' : activeNotice?.kind === 'maintenance' ? '저장 점검'
      : recovery?.refreshPending ? '화면 갱신 중' : onlyReviewed ? '확인한 알림' : recovery?.recovering || isRetrying ? '확인 중…' : '저장 상태';
    return <details ref={indicatorRef} className="teacher-storage-indicator" data-reviewed={onlyReviewed}>
      <summary><span role="status">{label}</span></summary>
      <div className="teacher-storage-indicator-content">
        {!onlyReviewed ? <p>{unsafe ? '화면을 닫기 전에 내용을 복사해 주세요.' : activeNotice?.kind === 'maintenance'
          ? '잠시 후 다시 저장해 주세요.' : activeNotice?.kind === 'update'
            ? '보관된 입력은 새로고침 후 다시 저장해 주세요.' : '이 기기의 저장 결과를 아직 확인하지 못했어요.'}</p> : null}
        {unsafe ? copyButton : activeNotice?.kind === 'update'
          ? <button type="button" onClick={reload}>새로고침</button>
          : <button type="button" disabled={isRetrying || reviewing || recovery?.recovering} onClick={retry}>{isRetrying ? '확인 중…' : '다시 확인'}</button>}
        {!unsafe && !activeNotice ? recoveryDetails : null}
        {retryError ? <p role="status">{retryError}</p> : null}
        {reloadBlocked ? <p>내용을 복사한 뒤 새로고침해 주세요.</p> : null}
        {fallback}
      </div>
    </details>;
  }
  if (!notice || notice.actor !== actor) {
    const banner = <aside className="storage-availability-banner" data-in-dialog={dialog !== null} role="alert">
      <div><strong>이 기기에 임시 보관하지 못했어요</strong>
        <p>화면을 닫기 전에 내용을 복사해 주세요.</p></div>
      {copyButton}
      {fallback}
    </aside>;
    return typeof document === 'undefined' ? banner : createPortal(banner, dialog ?? document.body);
  }
  const banner = <aside className="storage-availability-banner" data-in-dialog={dialog !== null} role="alert">
    <div><strong>{notice.kind === 'maintenance' ? '저장 서비스 점검 중' : '저장 확인이 필요해요'}</strong>
      <p>{reloadBlocked ? '작성 내용을 기기에 보관하지 못했습니다. 새로고침하지 말고 내용을 따로 복사해 주세요.'
        : notice.kind === 'maintenance' ? '잠시 후 다시 저장해 주세요.' : '보관된 입력은 새로고침 후 다시 저장해 주세요.'}</p>
    </div>
    {unsafe ? copyButton : null}
    {fallback}
    {notice.kind === 'update' ? <button type="button" onClick={reload}><RefreshCw size={18} aria-hidden="true" />새로고침</button> : null}
    <button type="button" aria-label="저장 안내 닫기" onClick={() => { setReloadBlocked(false); dismissStorageAvailabilityNotice(); }}><X size={20} /></button>
  </aside>;
  return typeof document === 'undefined' ? banner : createPortal(banner, dialog ?? document.body);
}
