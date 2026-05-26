import React from 'react';
import { Card, Row, Col, Tag, Spin, Typography } from 'antd';
import type { SchedulingConstraints, SchedulingObjective } from '../../../../services/production';

export interface SchedulingLegendMetrics {
  totalLockedCount: number;
  manualFrozenCount: number;
  freezeWindowLockedCount: number;
  executableCount: number;
  highRiskCount: number;
  bottleneckCount: number;
  setupSwitchCount: number;
}

interface SchedulingHeaderBandProps {
  constraints: SchedulingConstraints;
  selectedWorkOrderCount: number;
  objectiveLabels: Record<SchedulingObjective, string>;
  legendMetrics: SchedulingLegendMetrics;
  planReliabilityLoading: boolean;
  planReliability?: {
    total_active_orders?: number;
    plan_stability_index?: number;
    schedule_adherence_rate?: number;
    freeze_violation_count?: number;
    rolling_adjustment_count_24h?: number;
    reschedule_events_24h?: number;
  };
}

const SchedulingHeaderBand: React.FC<SchedulingHeaderBandProps> = ({
  constraints,
  selectedWorkOrderCount,
  objectiveLabels,
  legendMetrics,
  planReliabilityLoading,
  planReliability,
}) => (
  <Card className="aps-delfoi-workspace" size="small" style={{ marginBottom: 0 }}>
    <Row gutter={[12, 8]} align="middle">
      <Col flex="auto">
        <div className="aps-top-inline">
          <Tag color="blue">目标: {objectiveLabels[constraints.optimize_objective] || constraints.optimize_objective}</Tag>
          <Tag color="purple">冻结窗: {constraints.freeze_horizon_days} 天</Tag>
          <Tag color="cyan">滚动窗: {constraints.rolling_horizon_days} 天</Tag>
          <Tag color="orange">换型切换: {constraints.setup_changeover_hours}h</Tag>
          <Tag color="gold">已选工单: {selectedWorkOrderCount}</Tag>
          <Tag color="purple">
            🔒 锁定工单: {legendMetrics.totalLockedCount}
            （冻结 {legendMetrics.manualFrozenCount} / 冻结窗 {legendMetrics.freezeWindowLockedCount}）
          </Tag>
          <Tag color="gold">🟨 可执行工单: {legendMetrics.executableCount}</Tag>
          <Tag color="red">🟥 高风险延期: {legendMetrics.highRiskCount}</Tag>
          <Tag color="blue">🟦 瓶颈工作中心: {legendMetrics.bottleneckCount}</Tag>
          <Tag color="orange">🟧 换型切换次数: {legendMetrics.setupSwitchCount}</Tag>
        </div>
      </Col>
    </Row>
    <div className="aps-section-divider" />
    {planReliabilityLoading ? (
      <div style={{ paddingTop: 8 }}>
        <Spin size="small" />
      </div>
    ) : (
      <div className="aps-metrics-inline">
        <Typography.Text strong>计划可信度看板（24h）</Typography.Text>
        <Typography.Text>活跃工单：{planReliability?.total_active_orders ?? 0}</Typography.Text>
        <Typography.Text>计划稳定指数：{planReliability?.plan_stability_index ?? 0}%</Typography.Text>
        <Typography.Text>按计划开工率：{planReliability?.schedule_adherence_rate ?? 0}%</Typography.Text>
        <Typography.Text type={(planReliability?.freeze_violation_count || 0) > 0 ? 'danger' : undefined}>
          冻结违规：{planReliability?.freeze_violation_count ?? 0}
        </Typography.Text>
        <Typography.Text>滚动调整：{planReliability?.rolling_adjustment_count_24h ?? 0}</Typography.Text>
        <Typography.Text>重排事件：{planReliability?.reschedule_events_24h ?? 0}</Typography.Text>
      </div>
    )}
  </Card>
);

export default SchedulingHeaderBand;
