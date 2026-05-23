/**
 * 工作台 KPI 下方：在制工序卡（自动换行）
 */

import React from 'react';
import { Button, Empty, Space } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { getProcessProgress } from '../../../services/dashboard';
import { DashboardSectionCard } from './DashboardSectionCard';
import { WipOperationCardView } from './WipOperationCardView';

export interface DashboardOperationCardsPanelProps {
  cardRadius: number | string;
  cardShadow: string;
  isDark?: boolean;
  t: TFunction;
  onNavigate: (path: string) => void;
}

export function DashboardOperationCardsPanel({
  cardRadius,
  cardShadow,
  isDark = false,
  t,
  onNavigate,
}: DashboardOperationCardsPanelProps) {
  const { data: items, isLoading, isFetching } = useQuery({
    queryKey: ['dashboard-wip-operation-cards'],
    queryFn: () => getProcessProgress(false),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const workOrdersPath = '/apps/kuaizhizao/production-execution/work-orders?status=in_progress';

  return (
    <DashboardSectionCard
      className="dashboard-section--operation-cards"
      loading={isLoading || (isFetching && !items)}
      title={t('pages.dashboard.operationCardsTitle')}
      extra={
        <Space size={8} align="center">
          {items && items.length > 0 ? (
            <span className="dashboard-operation-cards-panel__count">
              {t('pages.dashboard.operationCardsCount', { count: items.length })}
            </span>
          ) : null}
          <Button type="link" size="small" onClick={() => onNavigate(workOrdersPath)}>
            {t('pages.dashboard.viewAll')} <RightOutlined />
          </Button>
        </Space>
      }
      cardRadius={cardRadius}
      cardShadow={cardShadow}
      styles={{
        body: {
          padding: '12px 16px 14px',
          boxSizing: 'border-box',
        },
      }}
    >
      {!items || items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('pages.dashboard.operationCardsEmpty')}
        />
      ) : (
        <div className="dashboard-operation-cards-panel__track">
          {items.map((item, index) => (
            <WipOperationCardView
              key={`${item.process_id}-${item.process_name}`}
              item={item}
              colorIndex={index}
              isDark={isDark}
              t={t}
              onClick={() => onNavigate(workOrdersPath)}
            />
          ))}
        </div>
      )}
    </DashboardSectionCard>
  );
}

export default DashboardOperationCardsPanel;
