import React from 'react';
import { Empty, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { MarkerTag } from '../../../../constants/statusBadges';
import { formatDateTime } from '../../../../utils/format';

const { Text } = Typography;

export type ModuleBroadcastItem = {
  id: string;
  operator_name?: string;
  process_name?: string;
  product_name?: string;
  work_order_no?: string;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  created_at?: string;
};

function processChipLabel(processName: string, operatorName: string): string {
  const process = processName.trim();
  if (process && process !== '—') return Array.from(process)[0] ?? '';
  const operator = operatorName.trim();
  if (operator && operator !== '—') return Array.from(operator)[0] ?? '';
  return '';
}

export function ModuleBroadcastList({
  items,
  emptyText,
  onItemClick,
}: {
  items: ModuleBroadcastItem[];
  emptyText: string;
  onItemClick?: (item: ModuleBroadcastItem) => void;
}) {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  if (!items.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <div className="module-broadcast-list">
      {items.map((item) => {
        const unqualified = item.unqualified_quantity ?? 0;
        const hasUnqualified = unqualified > 0;
        const accent = hasUnqualified ? token.colorError : token.colorSuccess;
        const processName = (item.process_name || '').trim() || '—';
        const operator = (item.operator_name || '').trim() || '—';
        const product = (item.product_name || '').trim();
        const workOrder = (item.work_order_no || '').trim();
        const clickable = Boolean(onItemClick);

        return (
          <div
            key={item.id}
            className={
              clickable
                ? 'module-broadcast-item module-broadcast-item--interactive'
                : 'module-broadcast-item'
            }
            onClick={clickable ? () => onItemClick?.(item) : undefined}
            style={{
              borderColor: token.colorBorderSecondary,
              background: token.colorBgContainer,
            }}
          >
            <div
              className="module-broadcast-item__chip"
              style={{
                background: `color-mix(in srgb, ${accent} 14%, ${token.colorBgContainer})`,
                color: accent,
              }}
            >
              {processChipLabel(processName, operator)}
            </div>
            <div className="module-broadcast-item__body">
              <div className="module-broadcast-item__title-row">
                <Text strong ellipsis className="module-broadcast-item__process" style={{ flex: 1, minWidth: 0 }}>
                  {processName}
                </Text>
                <Text type="secondary" className="module-broadcast-item__time">
                  {item.created_at ? formatDateTime(item.created_at, 'MM-DD HH:mm') : ''}
                </Text>
              </div>
              <Text type="secondary" ellipsis className="module-broadcast-item__operator">
                {operator} {t('app.kuaizhizao.productionExecutionDashboard.broadcastAction')}
              </Text>
              {product ? (
                <Text ellipsis className="module-broadcast-item__product">
                  {product}
                </Text>
              ) : null}
              {workOrder ? (
                <Text type="secondary" ellipsis className="module-broadcast-item__work-order">
                  {workOrder}
                </Text>
              ) : null}
              <div className="module-broadcast-item__tags">
                <MarkerTag color="success" style={{ marginInlineEnd: 0 }}>
                  {t('app.kuaizhizao.productionExecutionDashboard.broadcastQualified')}{' '}
                  {item.qualified_quantity ?? 0}
                </MarkerTag>
                {hasUnqualified ? (
                  <MarkerTag color="error" style={{ marginInlineEnd: 0 }}>
                    {t('app.kuaizhizao.productionExecutionDashboard.broadcastUnqualified')}{' '}
                    {unqualified}
                  </MarkerTag>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ModuleBroadcastList;
