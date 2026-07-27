import React from 'react';
import { Card, Tag, Spin, Typography, Tooltip } from 'antd';
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
  selectedOperationCount: number;
  resourceViewStats: { stationCount: number; taskCount: number };
  legendMetrics: SchedulingLegendMetrics;
  planReliabilityLoading: boolean;
  planReliability?: {
    total_active_orders?: number;
    schedule_adherence_rate?: number;
  };
  /** 排产必填设置缺失项数量；>0 时在顶部条展示并可点击补齐 */
  missingSettingsCount?: number;
  missingSettingsActionDisabled?: boolean;
  onMissingSettingsClick?: () => void;
}

const SchedulingHeaderBand: React.FC<SchedulingHeaderBandProps> = ({
  constraints,
  selectedWorkOrderCount,
  selectedOperationCount,
  resourceViewStats,
  legendMetrics,
  planReliabilityLoading,
  planReliability,
  missingSettingsCount = 0,
  missingSettingsActionDisabled = false,
  onMissingSettingsClick,
}) => {
  const { t } = useTranslation();
  const hasMissingSettings = missingSettingsCount > 0;

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
        {hasMissingSettings ? (
          <Tooltip
            title={t('app.kuaizhizao.scheduling.alert.missingSettings', {
              count: missingSettingsCount,
            })}
          >
            <Tag
              color="orange"
              className={
                missingSettingsActionDisabled
                  ? 'aps-header-band-missing-tag aps-header-band-missing-tag-disabled'
                  : 'aps-header-band-missing-tag'
              }
              onClick={
                missingSettingsActionDisabled || !onMissingSettingsClick
                  ? undefined
                  : onMissingSettingsClick
              }
            >
              {t('app.kuaizhizao.scheduling.headerBand.missingSettings', {
                count: missingSettingsCount,
              })}
              {!missingSettingsActionDisabled
                ? ` ${t('app.kuaizhizao.scheduling.alert.missingSettingsAction')}`
                : ''}
            </Tag>
          </Tooltip>
        ) : null}
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
        <Typography.Text type="secondary" className="aps-header-band-resource-stats">
          {t('app.kuaizhizao.scheduling.ganttToolbar.stationOpStats', {
            stations: resourceViewStats.stationCount,
            operations: resourceViewStats.taskCount,
          })}
          {selectedWorkOrderCount > 0
            ? selectedOperationCount > 0
              ? t('app.kuaizhizao.scheduling.ganttToolbar.selectedStats', {
                  workOrders: selectedWorkOrderCount,
                  operations: selectedOperationCount,
                })
              : t('app.kuaizhizao.scheduling.ganttToolbar.selectedWorkOrdersOnly', {
                  workOrders: selectedWorkOrderCount,
                })
            : ''}
        </Typography.Text>
      </div>
    </Card>
  );
};

export default SchedulingHeaderBand;
