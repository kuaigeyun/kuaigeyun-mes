/**
 * 在制工序卡（工作台展示）
 */

import React, { useMemo } from 'react';
import { theme } from 'antd';
import type { TFunction } from 'i18next';
import type { ProcessProgressItem } from '../../../services/dashboard';
import { getQuickEntryHeaderColors } from '../../../components/quick-entry/quickEntryGradients';
import { useThemeStore } from '../../../stores/themeStore';

function formatQty(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export interface WipOperationCardViewProps {
  item: ProcessProgressItem;
  colorIndex: number;
  isDark?: boolean;
  t: TFunction;
  onClick?: () => void;
}

export function WipOperationCardView({
  item,
  colorIndex,
  isDark = false,
  t,
  onClick,
}: WipOperationCardViewProps) {
  const { token } = theme.useToken();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const isPlain = themeStyle === 'plain';
  const completed = item.completed_quantity ?? 0;
  const headerColors = useMemo(
    () =>
      getQuickEntryHeaderColors(
        colorIndex,
        isDark,
        themeStyle,
        token.colorPrimary,
        token.colorPrimaryBg,
      ),
    [colorIndex, isDark, themeStyle, token.colorPrimary, token.colorPrimaryBg],
  );
  const progressPct = Math.min(100, Math.max(0, Math.round(item.current_progress ?? 0)));

  return (
    <button
      type="button"
      className={['dashboard-wip-operation-card', isPlain ? 'dashboard-wip-operation-card--plain' : '']
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={!onClick}
    >
      <div
        className="dashboard-wip-operation-card__head"
        style={{ background: headerColors.progressBackground }}
      >
        <div
          className="dashboard-wip-operation-card__head-fill"
          style={{
            width: `${progressPct}%`,
            background: headerColors.solid,
          }}
        />
        <div className="dashboard-wip-operation-card__head-content">
          <span
            className="dashboard-wip-operation-card__head-name"
            title={item.process_name}
          >
            {item.process_name}
          </span>
          <span className="dashboard-wip-operation-card__head-progress">
            {t('pages.dashboard.wipOperationCurrentProgress', { value: progressPct })}
          </span>
        </div>
      </div>

      <div className="dashboard-wip-operation-card__body">
        <div className="dashboard-wip-operation-card__main">
          <div className="dashboard-wip-operation-card__main-value">
            {formatQty(item.planned_quantity)}
          </div>
          <div className="dashboard-wip-operation-card__main-label">
            {t('pages.dashboard.wipOperationTaskQty')}
          </div>
        </div>

        <div className="dashboard-wip-operation-card__metrics">
          <div className="dashboard-wip-operation-card__metric-row">
            <span className="dashboard-wip-operation-card__metric-label">
              {t('pages.dashboard.wipOperationCompletedQty')}
            </span>
            <span className="dashboard-wip-operation-card__metric-value dashboard-wip-operation-card__metric-value--primary">
              {formatQty(completed)}
            </span>
          </div>
          <div className="dashboard-wip-operation-card__metric-row">
            <span className="dashboard-wip-operation-card__metric-label">
              {t('pages.dashboard.wipOperationQualifiedQty')}
            </span>
            <span className="dashboard-wip-operation-card__metric-value dashboard-wip-operation-card__metric-value--success">
              {formatQty(item.qualified_quantity)}
            </span>
          </div>
          <div className="dashboard-wip-operation-card__metric-row">
            <span className="dashboard-wip-operation-card__metric-label">
              {t('pages.dashboard.wipOperationUnqualifiedQty')}
            </span>
            <span className="dashboard-wip-operation-card__metric-value dashboard-wip-operation-card__metric-value--danger">
              {formatQty(item.unqualified_quantity)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default WipOperationCardView;
