import type { ReactNode } from 'react';

export type SettingsStatusTone = 'neutral' | 'accent' | 'warning' | 'urgent';

export function SettingsStatusChip({ tone = 'neutral', children }: { tone?: SettingsStatusTone; children: ReactNode }) {
  return <span className="settings-frame-chip" data-tone={tone}>{children}</span>;
}

interface SettingsPanelFrameProps {
  readonly label: string;
  readonly status: ReactNode;
  readonly action?: ReactNode;
  readonly details?: ReactNode;
  readonly detailsLabel?: string;
  readonly className?: string;
  readonly children?: ReactNode;
}

// 모든 교사 설정 패널의 공통 골격: 현재 상태 → 주요 행동 1개 → 본문 → 접힌 세부 설정.
export default function SettingsPanelFrame({ label, status, action, details, detailsLabel = '세부 설정', className, children }: SettingsPanelFrameProps) {
  return (
    <section className={`settings-frame${className ? ` ${className}` : ''}`} aria-label={label}>
      <div className="settings-frame-head">
        <div className="settings-frame-status">{status}</div>
        {action ? <div className="settings-frame-action">{action}</div> : null}
      </div>
      {children}
      {details ? (
        <details className="settings-disclosure settings-frame-details">
          <summary>{detailsLabel}</summary>
          <div className="settings-frame-details-body">{details}</div>
        </details>
      ) : null}
    </section>
  );
}
