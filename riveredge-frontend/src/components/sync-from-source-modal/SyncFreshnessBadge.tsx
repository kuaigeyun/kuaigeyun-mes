/**
 * 列表工具栏旁：外部同步新鲜度。
 * 上次同步 / 可能滞后等信息只挂在同步按钮（children）的 hover 上，不单独占位、不出徽章。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { HistoryOutlined } from '@ant-design/icons';
import { Tooltip, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from '../../config/dayjs';
import { formatDateTimeBySiteSetting, getTimezoneFromSiteSetting } from '../../utils/format';

export type SyncFreshnessBindingMeta = {
  source_type?: string | null;
  api_uuid?: string | null;
  dataset_uuid?: string | null;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  last_success_at?: string | null;
  last_error?: string | null;
};

export interface SyncFreshnessBadgeProps {
  getBinding: () => Promise<SyncFreshnessBindingMeta>;
  /** 同步完成或弹窗关闭后递增，触发重新拉取水位 */
  refreshKey?: number;
  /**
   * @deprecated 不再单独占位展示徽章；请传入 children（同步按钮）把提示挂到 hover。
   * 保留参数以免旧调用方类型报错，传入时忽略。
   */
  compact?: boolean;
  /** 无新鲜度信息时仍展示的说明（如「从外部系统同步…」），有滞后/上次同步时一并展示 */
  baseTip?: React.ReactNode;
  /**
   * 若传入（如同步按钮），将新鲜度说明挂到该节点的 Tooltip 上；
   * 未传入时用历史图标作为 hover 目标（无同步按钮可挂的极窄场景）。
   */
  children?: React.ReactNode;
}

function hasConfiguredSource(binding: SyncFreshnessBindingMeta): boolean {
  if (binding.source_type === 'api') return Boolean(binding.api_uuid);
  if (binding.source_type === 'dataset') return Boolean(binding.dataset_uuid);
  return Boolean(binding.api_uuid || binding.dataset_uuid);
}

function isScheduledMode(mode?: string): boolean {
  return mode === 'scheduled_incremental' || mode === 'scheduled_full';
}

function minutesSinceLastSuccess(lastSuccessAt: string): number | null {
  const tz = getTimezoneFromSiteSetting();
  const raw = String(lastSuccessAt).trim().replace('T', ' ');
  const success = dayjs.tz(raw, 'YYYY-MM-DD HH:mm:ss', tz);
  if (!success.isValid()) return null;
  return dayjs().tz(tz).diff(success, 'minute');
}

function isLagging(binding: SyncFreshnessBindingMeta): boolean {
  if (binding.last_error) return true;
  if (!isScheduledMode(binding.sync_mode)) return false;
  if (!binding.last_success_at) return true;
  const interval =
    binding.schedule_interval_minutes && binding.schedule_interval_minutes > 0
      ? binding.schedule_interval_minutes
      : 15;
  const age = minutesSinceLastSuccess(binding.last_success_at);
  if (age == null) return false;
  return age > interval;
}

export const SyncFreshnessBadge: React.FC<SyncFreshnessBadgeProps> = ({
  getBinding,
  refreshKey = 0,
  baseTip,
  children,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [binding, setBinding] = useState<SyncFreshnessBindingMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await getBinding();
        if (!cancelled) setBinding(next);
      } catch {
        if (!cancelled) setBinding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getBinding, refreshKey]);

  const lagging = Boolean(binding && hasConfiguredSource(binding) && isLagging(binding));
  const lastSuccessLabel =
    binding?.last_success_at && hasConfiguredSource(binding)
      ? formatDateTimeBySiteSetting(binding.last_success_at)
      : null;

  const lastSyncTip = useMemo(() => {
    if (!lastSuccessLabel) return null;
    return t('components.syncFromSource.freshnessLastSync', { time: lastSuccessLabel });
  }, [lastSuccessLabel, t]);

  const hoverTip = useMemo(() => {
    const lines: React.ReactNode[] = [];
    if (baseTip) lines.push(<div key="base">{baseTip}</div>);
    if (binding && hasConfiguredSource(binding)) {
      if (lastSyncTip) lines.push(<div key="last">{lastSyncTip}</div>);
      if (lagging) {
        lines.push(
          <div key="lag">
            {binding.last_error
              ? t('components.syncFromSource.lastError', { error: binding.last_error })
              : `${t('components.syncFromSource.freshnessLag')}：${t(
                  'components.syncFromSource.freshnessLagHint',
                )}`}
          </div>,
        );
      }
    }
    if (lines.length === 0) return null;
    // 错误摘要可能很长：限高可滚，避免 Tooltip 盖住同步按钮本身
    return (
      <div
        style={{
          maxWidth: 360,
          maxHeight: 'min(240px, 40vh)',
          overflowY: 'auto',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
        }}
      >
        {lines}
      </div>
    );
  }, [baseTip, binding, lagging, lastSyncTip, t]);

  if (children) {
    if (!hoverTip) return <>{children}</>;
    return (
      <Tooltip title={hoverTip} placement="bottomLeft">
        <span style={{ display: 'inline-flex' }}>{children}</span>
      </Tooltip>
    );
  }

  if (!binding || !hasConfiguredSource(binding) || !hoverTip) {
    return null;
  }

  return (
    <Tooltip title={hoverTip} placement="bottomLeft">
      <HistoryOutlined
        aria-label={
          typeof lastSyncTip === 'string'
            ? lastSyncTip
            : t('components.syncFromSource.freshnessLag')
        }
        style={{ fontSize: 14, color: token.colorTextSecondary, cursor: 'default' }}
      />
    </Tooltip>
  );
};

export default SyncFreshnessBadge;
