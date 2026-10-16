interface StableLabelProps {
  readonly label: string;
  readonly busyLabel: string;
  readonly busy: boolean;
  readonly align?: 'start' | 'center';
}

// Both labels share one grid cell, so swapping to a progress label keeps the control's size and nearby layout.
export default function StableLabel({ label, busyLabel, busy, align = 'center' }: StableLabelProps) {
  return (
    <span className="stable-label" data-align={align}>
      <span className="stable-label-option" data-active={!busy} aria-hidden={busy || undefined}>{label}</span>
      <span className="stable-label-option" data-active={busy} aria-hidden={!busy || undefined}>{busyLabel}</span>
    </span>
  );
}
