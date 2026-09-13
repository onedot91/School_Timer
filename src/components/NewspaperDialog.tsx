import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalFocus } from '../lib/useModalFocus';

export default function NewspaperDialog({ title, onClose, busy = false, children }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useModalFocus({ dialogRef: ref, isOpen: true, onDismiss: onClose, isDismissible: !busy });
  useEffect(() => {
    const overflow = document.body.style.overflow;
    const parents = [...document.querySelectorAll('[aria-modal="true"]')].filter(node => node !== ref.current);
    parents.forEach(node => node.setAttribute('aria-modal', 'false'));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; parents.forEach(node => node.setAttribute('aria-modal', 'true')); };
  }, []);
  return createPortal(<div className="newspaper-dialog-backdrop" onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div className="newspaper-dialog newspaper" ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} aria-busy={busy}>
      <header className="newspaper-toolbar"><h2 id={id}>{title}</h2><button disabled={busy} onClick={onClose} aria-label={`${title} 닫기`}><X size={20} /></button></header>
      {children}
    </div>
  </div>, document.body);
}
