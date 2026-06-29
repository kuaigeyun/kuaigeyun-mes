/**
 * 工作台 KPI 下方：在制工序卡（自动换行）
 */

import React from 'react';
import { Button, Empty, Grid, Space } from 'antd';
import { DownOutlined, RightOutlined, UpOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { getProcessProgress } from '../../../services/dashboard';
import { DashboardSectionCard } from './DashboardSectionCard';
import { WipOperationCardView } from './WipOperationCardView';

export interface DashboardOperationCardsPanelProps {
  cardRadius: number | string;
  isDark?: boolean;
  t: TFunction;
  onNavigate: (path: string) => void;
}

export function DashboardOperationCardsPanel({
  cardRadius,
  isDark = false,
  t,
  onNavigate,
}: DashboardOperationCardsPanelProps) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const { data: items, isLoading, isFetching } = useQuery({
    queryKey: ['dashboard-wip-operation-cards'],
    queryFn: () => getProcessProgress(false),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const workOrdersPath = '/apps/kuaizhizao/production-execution/work-orders?status=in_progress';
  const columnCount = React.useMemo(() => {
    if (screens.xl) return 4;
    if (screens.lg) return 3;
    if (screens.sm) return 2;
    return 1;
  }, [screens]);
  const initialVisibleCount = columnCount * 2;
  const totalCount = items?.length ?? 0;
  const [visibleCount, setVisibleCount] = React.useState(initialVisibleCount);

  React.useEffect(() => {
    setVisibleCount(initialVisibleCount);
  }, [initialVisibleCount, totalCount]);

  const visibleItems = React.useMemo(
    () => (items ?? []).slice(0, visibleCount),
    [items, visibleCount],
  );
  const hasMoreItems = totalCount > visibleItems.length;
  const canCollapse = totalCount > initialVisibleCount && visibleCount > initialVisibleCount;

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
        <>
          <div className="dashboard-operation-cards-panel__track">
            {visibleItems.map((item, index) => (
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
          {hasMoreItems || canCollapse ? (
            <div className="dashboard-operation-cards-panel__load-more-wrap">
              <Button
                size="small"
                shape="circle"
                type="text"
                className="dashboard-operation-cards-panel__load-more-btn"
                icon={hasMoreItems ? <DownOutlined /> : <UpOutlined />}
                aria-label={
                  hasMoreItems
                    ? t('common.loadMore', { defaultValue: '加载更多' })
                    : t('common.collapse', { defaultValue: '收起' })
                }
                onClick={() => {
                  if (hasMoreItems) {
                    setVisibleCount((prev) => Math.min(totalCount, prev + columnCount));
                  } else {
                    setVisibleCount(initialVisibleCount);
                  }
                }}
              />
            </div>
          ) : null}
        </>
      )}
    </DashboardSectionCard>
  );
}

export default DashboardOperationCardsPanel;
