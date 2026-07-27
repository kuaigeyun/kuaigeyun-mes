/**
 * 工单列表「工序」步骤轴：按实际节点数全部展开显示（不限宽）。
 */

import React, { useMemo } from 'react';
import { Tooltip, theme } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import {
  buildAllWorkOrderOperationStepSlots,
  type WorkOrderOperationStep,
} from '../workOrderOperationSteps';

export interface WorkOrderOperationStepsStripProps {
  steps?: WorkOrderOperationStep[] | null;
  /** 节点视觉尺寸 */
  compact?: boolean;
}

export function WorkOrderOperationStepsStrip({
  steps,
  compact = true,
}: WorkOrderOperationStepsStripProps) {
  const { token } = theme.useToken();

  const slots = useMemo(() => {
    const list = Array.isArray(steps) ? steps.filter((s) => s && String(s.name ?? '').trim()) : [];
    return buildAllWorkOrderOperationStepSlots(list);
  }, [steps]);

  const nodeSize = compact ? 28 : 32;
  const progressFontSize = compact ? 9 : 10;
  const labelFontSize = compact ? 11 : 12;
  const labelGap = compact ? 2 : 4;
  const slotWidth = compact ? 56 : 64;

  const doneColor = token.colorSuccess;
  const activeColor = token.colorPrimary;
  const pendingBorder = token.colorBorderSecondary;
  const labelDim = token.colorTextSecondary;
  const labelActive = token.colorPrimary;
  const labelDone = token.colorSuccess;
  const nodeBg = token.colorBgContainer;

  if (!slots.length) {
    return null;
  }

  const renderNode = (step: WorkOrderOperationStep) => {
    const isDone = step.status === 'done';
    const isActive = step.status === 'active';
    const isPending = step.status === 'pending';
    const borderColor = isPending ? pendingBorder : isDone ? doneColor : activeColor;

    return (
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: nodeSize,
          height: nodeSize,
          borderRadius: '50%',
          background: isDone ? doneColor : nodeBg,
          border: `2px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {isDone ? (
          <CheckOutlined style={{ color: '#fff', fontSize: compact ? 12 : 14 }} />
        ) : isActive ? (
          <span
            style={{
              color: activeColor,
              fontSize: progressFontSize,
              fontWeight: 700,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {step.progress}%
          </span>
        ) : null}
      </div>
    );
  };

  const trackWidth = slots.length * slotWidth;

  return (
    <div
      className="wo-ops-steps-strip"
      style={{
        width: trackWidth,
        minWidth: trackWidth,
        maxWidth: 'none',
        padding: compact ? '2px 0 0' : '4px 0 0',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          height: nodeSize,
          marginBottom: labelGap,
          width: trackWidth,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: slotWidth / 2,
            right: slotWidth / 2,
            top: '50%',
            transform: 'translateY(-50%)',
            height: 1,
            background: token.colorBorderSecondary,
            zIndex: 0,
          }}
        />
        {slots.map(({ key, step }) => {
          if (!step) return null;
          const node = renderNode(step);
          return (
            <div
              key={key}
              style={{
                position: 'relative',
                zIndex: 1,
                width: slotWidth,
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Tooltip title={`${step.name}${step.status === 'active' ? ` - ${step.progress}%` : ''}`}>
                {node}
              </Tooltip>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', width: trackWidth }}>
        {slots.map(({ key, step }) => {
          if (!step) return null;
          const isDone = step.status === 'done';
          const isActive = step.status === 'active';
          const isPending = step.status === 'pending';
          const labelColor = isPending ? labelDim : isActive ? labelActive : isDone ? labelDone : labelDim;
          return (
            <span
              key={key}
              title={step.name}
              style={{
                width: slotWidth,
                flexShrink: 0,
                fontSize: labelFontSize,
                color: labelColor,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
                userSelect: 'none',
              }}
            >
              {step.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default WorkOrderOperationStepsStrip;
