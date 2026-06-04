import React from 'react';

export interface GanttTaskLabelProps {
  productName?: string;
  workOrderCode?: string;
  primaryClassName?: string;
  title?: string;
  /** @deprecated 工位行请用 badgeCount */
  statusBadge?: string;
  /** 工位行数字角标（工序数） */
  badgeCount?: number;
  badgeTone?: 'idle' | 'busy' | 'conflict';
  /** 角标 hover 说明 */
  badgeTitle?: string;
}

function stationStatusBadgeClass(
  tone?: 'idle' | 'busy' | 'conflict',
  legacyStatus?: string
): string {
  if (tone === 'idle') return 'gantt-station-status-badge--idle';
  if (tone === 'conflict') return 'gantt-station-status-badge--conflict';
  if (tone === 'busy') return 'gantt-station-status-badge--busy';
  if (!legacyStatus) return 'gantt-station-status-badge--default';
  if (legacyStatus === '空闲') return 'gantt-station-status-badge--idle';
  if (legacyStatus.includes('冲突')) return 'gantt-station-status-badge--conflict';
  if (legacyStatus.includes('道工序')) return 'gantt-station-status-badge--busy';
  return 'gantt-station-status-badge--default';
}

/** 甘特图任务标签：默认两行；工位行可单行名称 + 数字角标 */
export const GanttTaskLabel: React.FC<GanttTaskLabelProps> = ({
  productName,
  workOrderCode,
  primaryClassName,
  title: titleAttr,
  statusBadge,
  badgeCount,
  badgeTone,
  badgeTitle,
}) => {
  const primary = (productName || workOrderCode || '—').trim();
  const code = workOrderCode?.trim();
  const legacyBadge = statusBadge?.trim();
  const showNumericBadge = badgeCount != null;
  const showLegacyBadge = !showNumericBadge && Boolean(legacyBadge);
  const badgeText = showNumericBadge ? String(badgeCount) : legacyBadge;
  const badgeHint = badgeTitle?.trim() || legacyBadge;
  const tooltip =
    titleAttr || [primary, badgeHint || code].filter(Boolean).join(' · ');

  if (showNumericBadge || showLegacyBadge) {
    return (
      <div className="gantt-task-label gantt-task-label--station-row" title={tooltip}>
        <div
          className={`gantt-task-label-primary${primaryClassName ? ` ${primaryClassName}` : ''}`}
          title={primary}
        >
          {primary}
        </div>
        <span
          className={[
            'gantt-station-status-badge',
            showNumericBadge ? 'gantt-station-status-badge--count' : '',
            stationStatusBadgeClass(badgeTone, legacyBadge),
          ]
            .filter(Boolean)
            .join(' ')}
          title={badgeHint}
        >
          {badgeText}
        </span>
      </div>
    );
  }

  return (
    <div className="gantt-task-label" title={tooltip}>
      <div className={`gantt-task-label-primary${primaryClassName ? ` ${primaryClassName}` : ''}`} title={primary}>
        {primary}
      </div>
      {code && primary !== code ? (
        <div className="gantt-task-label-code" title={code}>
          {code}
        </div>
      ) : null}
    </div>
  );
};

export default GanttTaskLabel;
