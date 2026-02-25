/**
 * UniLifecycleStepper - 所有节点展示，小进度圈之间用线连接
 *
 * 用于详情抽屉等需要「全节点+连线」展示的场景；与业务解耦，可复用。
 */

import React from 'react';
import { Tooltip } from 'antd';
import {
  BulbOutlined,
  ApartmentOutlined,
  CalculatorOutlined,
  InboxOutlined,
  FileAddOutlined,
  PlayCircleOutlined,
  SendOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  CarOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
  /** 当前阶段的下一步操作建议，可选 */
  nextStepSuggestions?: string[];
}

const NODE_SIZE = 40;
const LINE_MIN_WIDTH = 8;
const LINE_HEIGHT = 2;
const INNER_FONT_SIZE = 9;

/** 按阶段 key 映射默认图标 */
const STAGE_KEY_ICONS: Record<string, React.ReactNode> = {
  bom_check: <ApartmentOutlined />,
  demand_compute: <CalculatorOutlined />,
  material_ready: <InboxOutlined />,
  work_order_create: <FileAddOutlined />,
  work_order_exec: <PlayCircleOutlined />,
  product_inbound: <InboxOutlined />,
  sales_delivery: <SendOutlined />,
  draft: <FileTextOutlined />,
  pending_review: <ClockCircleOutlined />,
  rejected: <CloseCircleOutlined />,
  audited: <CheckCircleOutlined />,
  effective: <ThunderboltOutlined />,
  executing: <PlayCircleOutlined />,
  delivered: <CarOutlined />,
  completed: <CheckCircleOutlined />,
  pushed: <CheckCircleOutlined />,
};

function getIconForStage(step: SubStage): React.ReactNode {
  return step.icon ?? STAGE_KEY_ICONS[step.key] ?? <FileOutlined />;
}

function NodeCircle({
  status,
  isException,
  size,
  label,
  showLabelBelow,
  innerFontSize,
  icon,
  percent,
}: {
  status: SubStage['status'];
  isException?: boolean;
  size: number;
  label: string;
  showLabelBelow: boolean;
  innerFontSize: number;
  icon: React.ReactNode;
  percent?: number;
}) {
  // 最佳实践：已完成=绿，当前进行中=蓝，异常=红，待进行=灰
  const color =
    status === 'done'
      ? 'var(--ant-color-success)' // 已完成：绿色
      : status === 'active'
        ? isException
          ? 'var(--ant-color-error)' // 异常/驳回：红色
          : 'var(--ant-color-info, #1677ff)' // 当前进行中：蓝色
        : 'var(--ant-color-border)'; // 待进行：灰色
  const textColor =
    status === 'pending' ? 'var(--ant-color-text-tertiary)' : 'var(--ant-color-text)';
  const showPercent = percent != null && percent >= 0 && (status === 'active' || status === 'done');
  const iconSize = showPercent ? size * 0.32 : size * 0.45;
  const node = (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: 'var(--ant-color-bg-container)',
        border: `2px solid ${color}`,
        flexShrink: 0,
        boxSizing: 'border-box',
        gap: showPercent ? 1 : 0,
      }}
    >
      <span style={{ fontSize: iconSize, lineHeight: 1, color: textColor }}>{icon}</span>
      {showPercent && (
        <span
          style={{
            fontSize: innerFontSize,
            lineHeight: 1.1,
            color: textColor,
            fontWeight: 500,
          }}
        >
          {Math.round(percent)}%
        </span>
      )}
    </span>
  );
  const content = (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', minWidth: 0, overflow: 'hidden' }}>
      {node}
      {showLabelBelow && (
        <span
          style={{
            fontSize: 12,
            color: textColor,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            minWidth: 0,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
  const tooltipTitle = percent != null ? `${label} ${Math.round(percent)}%` : label;
  return <Tooltip title={tooltipTitle}>{content}</Tooltip>;
}

export const UniLifecycleStepper: React.FC<UniLifecycleStepperProps> = ({
  steps,
  status,
  nodeSize = NODE_SIZE,
  showLabels = true,
  innerFontSize = INNER_FONT_SIZE,
  nextStepSuggestions,
}) => {
  const { t } = useTranslation();
  const isException = status === 'exception';
  if (!steps.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="uni-lifecycle-stepper" style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'nowrap', gap: 0, width: '100%' }}>
        {steps.map((step, idx) => (
          <React.Fragment key={step.key}>
            {idx > 0 && (
              <span
                style={{
                  flex: 1,
                  minWidth: LINE_MIN_WIDTH,
                  alignSelf: 'center',
                  height: LINE_HEIGHT,
                  backgroundColor: 'var(--ant-color-border)',
                  marginBottom: showLabels ? 20 : 0,
                }}
              />
            )}
            <span style={{ flex: 1, minWidth: nodeSize, display: 'flex', justifyContent: 'center' }}>
              <span style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <NodeCircle
                  status={step.status}
                  isException={isException && step.status === 'active'}
                  size={nodeSize}
                  label={step.label}
                  showLabelBelow={showLabels}
                  innerFontSize={innerFontSize}
                  icon={getIconForStage(step)}
                  percent={step.percent}
                />
              </span>
            </span>
          </React.Fragment>
        ))}
      </div>
      {nextStepSuggestions && nextStepSuggestions.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            fontSize: 12,
            color: 'var(--ant-color-text-secondary)',
          }}
        >
          <BulbOutlined style={{ marginTop: 2, color: 'var(--ant-color-warning)' }} />
          <span>
            <span style={{ fontWeight: 500 }}>{t('components.uniLifecycle.nextStep')}：</span>
            {nextStepSuggestions.join(t('components.uniLifecycle.nextStepSeparator'))}
          </span>
        </div>
      )}
    </div>
  );
};
