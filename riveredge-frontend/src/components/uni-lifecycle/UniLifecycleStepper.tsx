/**
 * UniLifecycleStepper - 所有节点展示，小进度圈之间用线连接
 *
 * 用于详情抽屉等需要「全节点+连线」展示的场景；与业务解耦，可复用。
 */

import React from 'react';
import { Tooltip } from 'antd';
import type { SubStage } from './types';

export interface UniLifecycleStepperProps {
  /** 步骤列表，顺序即展示顺序 */
  steps: SubStage[];
  /** 异常态时当前节点用异常样式（如已驳回/已取消） */
  status?: 'success' | 'exception' | 'normal' | 'active';
  /** 节点尺寸（直径），默认 28（圆环内需容纳文字） */
  nodeSize?: number;
  /** 是否在节点下方再显示文案（默认 true） */
  showLabels?: boolean;
  /** 圆环内文字字号（默认 9，非常小） */
  innerFontSize?: number;
}

const NODE_SIZE = 40;
const LINE_WIDTH = 8;
const LINE_HEIGHT = 2;
const INNER_FONT_SIZE = 9;

function NodeCircle({
  status,
  isException,
  size,
  label,
  showLabelBelow,
  innerFontSize,
}: {
  status: SubStage['status'];
  isException?: boolean;
  size: number;
  label: string;
  showLabelBelow: boolean;
  innerFontSize: number;
}) {
  const color =
    status === 'done'
      ? 'var(--ant-color-success)'
      : status === 'active'
        ? isException
          ? 'var(--ant-color-error)'
          : 'var(--ant-color-primary)'
        : 'var(--ant-color-border)';
  const textColor =
    status === 'pending' ? 'var(--ant-color-text-tertiary)' : 'var(--ant-color-text)';
  const node = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: 'var(--ant-color-bg-container)',
        border: `2px solid ${color}`,
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontSize: innerFontSize,
          lineHeight: 1.1,
          color: textColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '85%',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </span>
  );
  const content = (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {node}
      {showLabelBelow && (
        <span style={{ fontSize: 12, color: textColor }}>{label}</span>
      )}
    </span>
  );
  return <Tooltip title={label}>{content}</Tooltip>;
}

export const UniLifecycleStepper: React.FC<UniLifecycleStepperProps> = ({
  steps,
  status,
  nodeSize = NODE_SIZE,
  showLabels = true,
  innerFontSize = INNER_FONT_SIZE,
}) => {
  const isException = status === 'exception';
  if (!steps.length) return null;

  return (
    <div className="uni-lifecycle-stepper" style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 0 }}>
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          {idx > 0 && (
            <span
              style={{
                alignSelf: 'center',
                width: LINE_WIDTH,
                minWidth: LINE_WIDTH,
                height: LINE_HEIGHT,
                backgroundColor: steps[idx - 1].status === 'done' ? 'var(--ant-color-primary)' : 'var(--ant-color-border)',
                marginBottom: showLabels ? 20 : 0,
              }}
            />
          )}
          <NodeCircle
            status={step.status}
            isException={isException && step.status === 'active'}
            size={nodeSize}
            label={step.label}
            showLabelBelow={showLabels}
            innerFontSize={innerFontSize}
          />
        </React.Fragment>
      ))}
    </div>
  );
};
