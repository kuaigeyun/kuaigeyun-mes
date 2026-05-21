/**
 * 工单综合分展示（含分解 Tooltip）
 */
import React from 'react';
import { Tag, Tooltip, Space } from 'antd';

const DIMENSION_LABELS: Record<string, string> = {
  manual_priority: '人工优先级',
  due_urgency: '交期紧迫度',
  demand_urgency: '需求交期',
  kitting_readiness: '齐套就绪',
  plan_fidelity: '计划一致性',
};

const BAND_COLORS: Record<string, string> = {
  A: 'red',
  B: 'orange',
  C: 'default',
};

export interface WorkOrderScoreCellProps {
  score?: number | null;
  rankBand?: string | null;
  breakdown?: Record<string, { score?: number; weight?: number; weighted?: number; raw?: unknown }> | null;
  emptyText?: string;
}

export const WorkOrderScoreCell: React.FC<WorkOrderScoreCellProps> = ({
  score,
  rankBand,
  breakdown,
  emptyText = '—',
}) => {
  if (score == null || Number.isNaN(Number(score))) {
    return (
      <Tag bordered color="default" style={{ margin: 0 }}>
        {emptyText}
      </Tag>
    );
  }

  const band = rankBand || (score >= 80 ? 'A' : score >= 60 ? 'B' : 'C');
  const tooltipContent = breakdown && Object.keys(breakdown).length > 0 ? (
    <div style={{ maxWidth: 280 }}>
      {Object.entries(breakdown).map(([key, item]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{DIMENSION_LABELS[key] || key}</span>
          <span>
            {item.score?.toFixed?.(0) ?? item.score}
            {' × '}
            {((item.weight ?? 0) * 100).toFixed(0)}%
            {' = '}
            <strong>{item.weighted?.toFixed?.(1) ?? item.weighted}</strong>
          </span>
        </div>
      ))}
    </div>
  ) : (
    '综合分由多维度加权计算，可在参数设置中配置权重'
  );

  return (
    <Tooltip title={tooltipContent}>
      <Space size={4} style={{ whiteSpace: 'nowrap' }}>
        <Tag bordered color="processing" style={{ cursor: 'help', margin: 0 }}>
          {Number(score).toFixed(1)}
        </Tag>
        <Tag bordered color={BAND_COLORS[band] || 'default'} style={{ cursor: 'help', margin: 0 }}>
          {band}
        </Tag>
      </Space>
    </Tooltip>
  );
};

export default WorkOrderScoreCell;
