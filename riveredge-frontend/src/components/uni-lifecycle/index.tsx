/**
 * UniLifecycle - 通用生命周期进度圈
 *
 * 与业务解耦，供销售订单、采购订单、工单等复用。
 * 展示主生命周期进度 + 可选的子生命周期（subPercent/subLabel 或 subStages 全链路）。
 */

import React from 'react';
import { Progress, Tooltip } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { LifecycleResult, SubStage } from './types';

export interface UniLifecycleProps extends LifecycleResult {
  /** 是否在圈旁显示阶段名，默认 false */
  showLabel?: boolean;
  /** 进度圈尺寸，默认 32 */
  size?: number | 'small';
  /** 是否在详情中展开显示全链路子阶段（Steps 列表），默认 false */
  expandSubStages?: boolean;
}

const CIRCLE_SIZE = 32;

function SubStageIcon({ status }: { status: SubStage['status'] }) {
  if (status === 'done') return <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} />;
  if (status === 'active') return <LoadingOutlined style={{ color: 'var(--ant-color-primary)' }} spin />;
  return <MinusCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />;
}

function TooltipContent(props: {
  stageName: string;
  subLabel?: string;
  subPercent?: number;
  subStages?: SubStage[];
}) {
  const { stageName, subLabel, subPercent, subStages } = props;
  if (subStages && subStages.length > 0) {
    return (
      <div style={{ maxWidth: 260 }}>
        <div style={{ marginBottom: 6, fontWeight: 600 }}>{stageName}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {subStages.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SubStageIcon status={s.status} />
              <span style={{ opacity: s.status === 'pending' ? 0.65 : 1 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (subLabel != null && subPercent != null) {
    return (
      <span>
        {stageName} · {subLabel} {Math.round(subPercent)}%
      </span>
    );
  }
  return <span>{stageName}</span>;
}

export const UniLifecycle: React.FC<UniLifecycleProps> = ({
  percent,
  stageName,
  status: progressStatus,
  subPercent,
  subLabel,
  subStages,
  showLabel = false,
  size = CIRCLE_SIZE,
  expandSubStages = false,
}) => {
  const sizeNum = size === 'small' ? CIRCLE_SIZE : typeof size === 'number' ? size : CIRCLE_SIZE;

  const tip = (
    <TooltipContent
      stageName={stageName}
      subLabel={subLabel}
      subPercent={subPercent}
      subStages={subStages}
    />
  );

  const circle = (
    <Progress
      type="circle"
      percent={Math.min(100, Math.max(0, Math.round(percent)))}
      size={sizeNum}
      status={progressStatus}
      strokeWidth={12}
      strokeColor={progressStatus === 'exception' ? 'var(--ant-color-error)' : undefined}
      railColor="var(--ant-color-border)"
    />
  );

  const withTooltip = <Tooltip title={tip}>{circle}</Tooltip>;

  return (
    <span className="uni-lifecycle" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {withTooltip}
      {showLabel && <span style={{ whiteSpace: 'nowrap' }}>{stageName}</span>}
      {expandSubStages && subStages && subStages.length > 0 && (
        <div style={{ marginTop: 8, marginLeft: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 16px', alignItems: 'center' }}>
            {subStages.map((s) => (
              <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <SubStageIcon status={s.status} />
                <span style={{ opacity: s.status === 'pending' ? 0.65 : 1 }}>{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </span>
  );
};

export { UniLifecycleStepper } from './UniLifecycleStepper';
export type { LifecycleResult, SubStage, SubStageStatus } from './types';
