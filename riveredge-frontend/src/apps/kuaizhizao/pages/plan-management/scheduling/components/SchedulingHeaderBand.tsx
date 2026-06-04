import React from 'react';
import { Card, Tag, Spin, Typography } from 'antd';
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
}) => (
  <Card className="aps-delfoi-workspace aps-header-band-compact" size="small" style={{ marginBottom: 0 }}>
    <div className="aps-top-inline">
      <Tag color="purple">冻结窗: {constraints.freeze_horizon_days} 天</Tag>
      <Tag color="gold">已选: {selectedWorkOrderCount}</Tag>
      <Tag color="purple">
        锁定: {legendMetrics.totalLockedCount}
        （冻 {legendMetrics.manualFrozenCount} / 窗 {legendMetrics.freezeWindowLockedCount}）
      </Tag>
      <Tag color="gold">可调整: {legendMetrics.executableCount}</Tag>
      <Tag color="volcano">冲突: {legendMetrics.conflictCount}</Tag>
      <Typography.Text type="secondary">|</Typography.Text>
      {planReliabilityLoading ? (
        <Spin size="small" />
      ) : (
        <>
          <Typography.Text>活跃工单 {planReliability?.total_active_orders ?? 0}</Typography.Text>
          <Typography.Text>开工率 {planReliability?.schedule_adherence_rate ?? 0}%</Typography.Text>
        </>
      )}
    </div>
  </Card>
);

export default SchedulingHeaderBand;
