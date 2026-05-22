/**
 * 插单模拟 · APS-Lite 权重分 What-if 预览（只读，不写库）
 */
import React from 'react';
import { Card, Space, Typography } from 'antd';
import { WorkOrderScoreCell } from '../apps/kuaizhizao/components/WorkOrderScoreCell';

export interface SchedulingScorePreviewData {
  scheduling_score: number;
  queue_rank: number;
  queue_total: number;
  breakdown?: Record<string, { score?: number; weight?: number; weighted?: number; raw?: unknown }> | null;
}

export interface SimulationSchedulingScorePreviewProps {
  preview?: SchedulingScorePreviewData | null;
  compact?: boolean;
}

export const SimulationSchedulingScorePreview: React.FC<SimulationSchedulingScorePreviewProps> = ({
  preview,
  compact = false,
}) => {
  if (!preview || preview.scheduling_score == null) {
    return null;
  }

  const body = (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Space wrap size="middle">
        <Space size={4}>
          <Typography.Text type="secondary">权重分</Typography.Text>
          <WorkOrderScoreCell
            score={preview.scheduling_score}
            breakdown={preview.breakdown}
          />
        </Space>
        <Typography.Text type="secondary">
          预估排程队列排位：第 <Typography.Text strong>{preview.queue_rank}</Typography.Text> / {preview.queue_total}
        </Typography.Text>
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        基于当前权重配置与齐套率模拟，不写入工单；正式下达后将按 M1 规则重算并持久化。
      </Typography.Text>
    </Space>
  );

  if (compact) {
    return <div style={{ marginTop: 8 }}>{body}</div>;
  }

  return (
    <Card size="small" title="权重分预览（APS-Lite What-if）" style={{ marginBottom: 16 }}>
      {body}
    </Card>
  );
};

export default SimulationSchedulingScorePreview;
