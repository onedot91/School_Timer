import { RefreshCw, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { dismissStorageAvailabilityNotice, getStorageAvailabilityNotice, subscribeStorageAvailability } from '../lib/storageAvailability';
import { canReloadWithDrafts, getUnsafeDraftRecoveryText, subscribeDraftReloadSafety, getDraftReloadSafetySnapshot } from '../lib/draftReloadSafety';
import { subscribeSaveRecovery, getSaveRecoverySnapshot, getSaveRecoveryStatus, requestSaveRecovery } from '../lib/saveRecovery';

export function StorageAvailabilityBanner({ actor, compact = false }: { readonly actor: number | null; readonly compact?: boolean }) {
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
  const needsRecovery = !!recovery && (recovery.pending > 0 || recovery.refreshPending || recovery.recovering);
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
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
  const retry = () => {
    if (actor === null || isRetrying) return;
    setIsRetrying(true);
    void requestSaveRecovery(actor).then(() => setIsRetrying(false), () => setIsRetrying(false));
  };
  const fallback = copyFallback ? <textarea aria-label="보관하지 못한 내용" readOnly value={copyFallback} onFocus={event => event.currentTarget.select()} className="max-h-28 min-w-0 p-2" /> : null;
  if (compact) {
    const activeNotice = notice?.actor === actor ? notice : null;
    const label = unsafe ? '보관 오류' : activeNotice?.kind === 'maintenance' ? '저장 점검'
      : recovery?.refreshPending ? '화면 갱신 중' : recovery?.recovering || isRetrying ? '확인 중…' : '저장 확인';
    return <details className="teacher-storage-indicator">
      <summary><span role="status">{label}</span></summary>
      <div className="teacher-storage-indicator-content">
        <p>{unsafe ? '화면을 닫기 전에 내용을 복사해 주세요.' : activeNotice?.kind === 'maintenance'
          ? '잠시 후 다시 저장해 주세요.' : activeNotice?.kind === 'update'
            ? '보관된 입력은 새로고침 후 다시 저장해 주세요.' : '이 기기의 저장 결과를 아직 확인하지 못했어요.'}</p>
        {unsafe ? copyButton : activeNotice?.kind === 'update'
          ? <button type="button" onClick={reload}>새로고침</button>
          : <button type="button" disabled={isRetrying || recovery?.recovering} onClick={retry}>{isRetrying ? '확인 중…' : '다시 확인'}</button>}
        {reloadBlocked ? <p>내용을 복사한 뒤 새로고침해 주세요.</p> : null}
        {fallback}
      </div>
    </details>;
  }
  if (!notice || notice.actor !== actor) {
    const banner = <aside className="storage-availability-banner" data-in-dialog={dialog !== null} role={unsafe ? 'alert' : 'status'}>
      <div><strong>{unsafe ? '이 기기에 임시 보관하지 못했어요' : recovery?.refreshPending ? '저장됨 · 화면 갱신 중' : recovery?.recovering ? '저장 확인 중' : '저장 확인이 필요해요'}</strong>
        {unsafe ? <p>화면을 닫기 전에 내용을 복사해 주세요.</p> : null}</div>
      {unsafe ? copyButton
        : <button type="button" disabled={isRetrying} onClick={retry}>{isRetrying ? '확인 중…' : '다시 확인'}</button>}
      {fallback}
    </aside>;
    return dialog ? createPortal(banner, dialog) : banner;
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
  return dialog ? createPortal(banner, dialog) : banner;
}
