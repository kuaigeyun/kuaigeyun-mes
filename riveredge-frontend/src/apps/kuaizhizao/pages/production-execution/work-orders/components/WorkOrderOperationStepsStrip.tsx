/**
 * 工单列表「工序」步骤轴：按实际节点数全部展开显示（不限宽）。
 * 低配机优化：无 antd Tooltip 门户、React.memo 跳过无关重渲染。
 */

import React, { useMemo } from 'react';
import { theme } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import {
  buildAllWorkOrderOperationStepSlots,
  type WorkOrderOperationStep,
} from '../workOrderOperationSteps';

export interface WorkOrderOperationStepsStripProps {
  steps?: WorkOrderOperationStep[] | null;
  /** 节点视觉尺寸 */
  compact?: boolean;
  /** 覆盖单槽宽度（px）；默认 compact=56 / 展开=64 */
  slotWidth?: number;
}

function stepsSignature(steps?: WorkOrderOperationStep[] | null): string {
  if (!steps?.length) return '';
  return steps
    .map((s) => `${s.name}\0${s.status}\0${s.progress ?? ''}\0${s.sequence ?? ''}`)
    .join('\n');
}

function WorkOrderOperationStepsStripInner({
  steps,
  compact = true,
  slotWidth: slotWidthProp,
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
  const slotWidth = slotWidthProp ?? (compact ? 56 : 64);

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
          const isDone = step.status === 'done';
          const isActive = step.status === 'active';
          const isPending = step.status === 'pending';
          const borderColor = isPending ? pendingBorder : isDone ? doneColor : activeColor;
          const title =
            isActive && typeof step.progress === 'number'
              ? `${step.name} - ${step.progress}%`
              : step.name;
          return (
            <div
              key={key}
              title={title}
              style={{
                position: 'relative',
                zIndex: 1,
                width: slotWidth,
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
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
                ) : isActive && typeof step.progress === 'number' ? (
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

function stripPropsAreEqual(
  prev: WorkOrderOperationStepsStripProps,
  next: WorkOrderOperationStepsStripProps,
): boolean {
  return (
    (prev.compact ?? true) === (next.compact ?? true) &&
    prev.slotWidth === next.slotWidth &&
    stepsSignature(prev.steps) === stepsSignature(next.steps)
  );
}

export const WorkOrderOperationStepsStrip = React.memo(
  WorkOrderOperationStepsStripInner,
  stripPropsAreEqual,
);

export default WorkOrderOperationStepsStrip;
