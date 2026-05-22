/**
 * 工单权重分展示（含分解 Tooltip）
 */
import React from 'react';
import { Tooltip } from 'antd';

const DIMENSION_LABELS: Record<string, string> = {
  manual_priority: '人工优先级',
  due_urgency: '交期紧迫度',
  demand_urgency: '需求交期',
  kitting_readiness: '齐套就绪',
  plan_fidelity: '计划一致性',
};

export interface WorkOrderScoreCellProps {
  score?: number | null;
  breakdown?: Record<string, { score?: number; weight?: number; weighted?: number; raw?: unknown }> | null;
  emptyText?: string;
}

export const WorkOrderScoreCell: React.FC<WorkOrderScoreCellProps> = ({
  score,
  breakdown,
  emptyText = '—',
}) => {
  if (score == null || Number.isNaN(Number(score))) {
    return <span style={{ color: '#999' }}>{emptyText}</span>;
  }

  const numericScore = Number(score);
  const tooltipContent = breakdown && Object.keys(breakdown).length > 0 ? (
    <div style={{ maxWidth: 300 }}>
      <div style={{ marginBottom: 6, fontWeight: 600 }}>权重分计算</div>
      {Object.entries(breakdown).map(([key, item]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, lineHeight: 1.6 }}>
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 6,
          paddingTop: 6,
          borderTop: '1px solid rgba(255,255,255,0.2)',
          fontWeight: 600,
        }}
      >
        <span>合计</span>
        <span>{numericScore.toFixed(1)}</span>
      </div>
    </div>
  ) : (
    '权重分由多维度加权计算，可在参数设置中配置权重'
  );

  return (
    <Tooltip title={tooltipContent}>
      <span
        style={{
          cursor: 'help',
          color: '#1677ff',
          borderBottom: '1px dashed #1677ff',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {numericScore.toFixed(1)}
      </span>
    </Tooltip>
  );
};

export default WorkOrderScoreCell;
