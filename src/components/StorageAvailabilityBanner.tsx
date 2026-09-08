import { RefreshCw, X } from 'lucide-react';
import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { dismissStorageAvailabilityNotice, getStorageAvailabilityNotice, subscribeStorageAvailability } from '../lib/storageAvailability';
import { canReloadWithDrafts } from '../lib/draftReloadSafety';

export function StorageAvailabilityBanner({ actor }: { readonly actor: number | null }) {
  const notice = useSyncExternalStore(subscribeStorageAvailability, getStorageAvailabilityNotice, () => null);
  const [reloadBlocked, setReloadBlocked] = useState(false);
  const [dialog, setDialog] = useState<Element | null>(null);
  useLayoutEffect(() => {
    if (!notice || notice.actor !== actor) return;
    const update = () => {
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      const owner = dialogs.item(dialogs.length - 1);
      setDialog(owner?.querySelector('.settings-parent-content') ?? owner ?? null);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-modal'] });
    return () => observer.disconnect();
  }, [notice, actor]);
  if (!notice || notice.actor !== actor) return null;
  const reload = () => {
    if (actor !== null && !canReloadWithDrafts(actor)) { setReloadBlocked(true); return; }
    window.location.reload();
  };
  const banner = <aside className="storage-availability-banner" data-in-dialog={dialog !== null} role="alert">
    <div><strong>{notice.kind === 'maintenance' ? '저장 서비스 점검 중' : '업데이트가 필요합니다'}</strong>
      <p>{reloadBlocked ? '작성 내용을 기기에 보관하지 못했습니다. 새로고침하지 말고 내용을 따로 복사해 주세요.'
        : notice.kind === 'maintenance' ? '잠시 후 다시 저장해 주세요.' : '보관된 입력은 새로고침 후 다시 저장해 주세요.'}</p>
    </div>
    {notice.kind === 'update' ? <button type="button" onClick={reload}><RefreshCw size={18} aria-hidden="true" />새로고침</button> : null}
    <button type="button" aria-label="저장 안내 닫기" onClick={() => { setReloadBlocked(false); dismissStorageAvailabilityNotice(); }}><X size={20} /></button>
  </aside>;
  return dialog ? createPortal(banner, dialog) : banner;
}
