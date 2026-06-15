import React from 'react';
import { Card, Tag, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SchedulingConstraints } from '../../../../services/production';

export interface SchedulingLegendMetrics {
  totalLockedCount: number;
  manualFrozenCount: number;
  freezeWindowLockedCount: number;
  executableCount: number;
  conflictCount: number;
}

interface SchedulingHeaderBandProps {
  constraints: SchedulingConstraints;
  selectedWorkOrderCount: number;
  legendMetrics: SchedulingLegendMetrics;
  planReliabilityLoading: boolean;
  planReliability?: {
    total_active_orders?: number;
    schedule_adherence_rate?: number;
  };
}

const SchedulingHeaderBand: React.FC<SchedulingHeaderBandProps> = ({
  constraints,
  selectedWorkOrderCount,
  legendMetrics,
  planReliabilityLoading,
  planReliability,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="aps-delfoi-workspace aps-header-band-compact" size="small" style={{ marginBottom: 0 }}>
      <div className="aps-top-inline">
        <Tag color="purple">
          {t('app.kuaizhizao.scheduling.headerBand.freezeWindowDays', {
            days: constraints.freeze_horizon_days,
          })}
        </Tag>
        <Tag color="gold">
          {t('app.kuaizhizao.scheduling.headerBand.selected', { count: selectedWorkOrderCount })}
        </Tag>
        <Tag color="purple">
          {t('app.kuaizhizao.scheduling.headerBand.locked', {
            total: legendMetrics.totalLockedCount,
            manual: legendMetrics.manualFrozenCount,
            window: legendMetrics.freezeWindowLockedCount,
          })}
        </Tag>
        <Tag color="gold">
          {t('app.kuaizhizao.scheduling.headerBand.adjustable', { count: legendMetrics.executableCount })}
        </Tag>
        <Tag color="volcano">
          {t('app.kuaizhizao.scheduling.headerBand.conflicts', { count: legendMetrics.conflictCount })}
        </Tag>
        <Typography.Text type="secondary">|</Typography.Text>
        {planReliabilityLoading ? (
          <Spin size="small" />
        ) : (
          <>
            <Typography.Text>
              {t('app.kuaizhizao.scheduling.headerBand.activeWorkOrders', {
                count: planReliability?.total_active_orders ?? 0,
              })}
            </Typography.Text>
            <Typography.Text>
              {t('app.kuaizhizao.scheduling.headerBand.scheduleAdherenceRate', {
                rate: planReliability?.schedule_adherence_rate ?? 0,
              })}
            </Typography.Text>
          </>
        )}
      </div>
    </Card>
  );
};

export default SchedulingHeaderBand;
