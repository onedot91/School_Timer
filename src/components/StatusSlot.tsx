import type { ReactNode } from 'react';

interface StatusSlotProps {
  readonly children?: ReactNode;
  readonly className?: string;
}

// Stays mounted with one reserved line, so a transient status does not push the content below it.
export default function StatusSlot({ children, className }: StatusSlotProps) {
  return (
    <p className={`status-slot${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      {children}
    </p>
  );
}
