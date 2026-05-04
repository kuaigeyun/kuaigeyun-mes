/**
 * UniLifecycleStepper - 所有节点展示，小进度圈之间用线连接
 *
 * 用于详情抽屉等需要「全节点+连线」展示的场景；与业务解耦，可复用。
 */

import React from 'react';
import { Tooltip } from 'antd';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Bell,
  Calculator,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  File,
  FilePlus,
  FileText,
  Handshake,
  Inbox,
  Layers,
  Lightbulb,
  Package,
  PackageCheck,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Truck,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './UniLifecycleStepper.less';
import type { SubStage } from './types';

export interface UniLifecycleStepperProps {
  /** 步骤列表，顺序即展示顺序 */
  steps: SubStage[];
  /** 异常态时当前节点用异常样式（如已驳回/已取消） */
  status?: 'success' | 'exception' | 'normal' | 'active';
  /** 节点尺寸（直径），默认 44 */
  nodeSize?: number;
  /** 是否在节点下方再显示文案（默认 true） */
  showLabels?: boolean;
  /** 圆环内进度文字字号（默认 10） */
  innerFontSize?: number;
  /** 当前阶段的下一步操作建议，可选 */
  nextStepSuggestions?: string[];
  /** 为 true 时不渲染下一步提示行（可由外层如抽屉区块标题承接） */
  hideNextStepSuggestions?: boolean;
  /** 相邻节点之间连接线固定宽度（水平间距），默认 44 */
  connectorWidth?: number;
  /** 单列文案展示宽度下限（列宽取 max(nodeSize, stepLabelMaxWidth)，防止标签区窄于节点宽度） */
  stepLabelMaxWidth?: number;
}

const NODE_SIZE = 44;
const CONNECTOR_WIDTH_DEFAULT = 44;
/** 默认给足横向空间；过长时允许换行而非省略号截断 */
const STEP_LABEL_MAX_WIDTH_DEFAULT = 180;
const INNER_FONT_SIZE = 10;

/** 按阶段 key 映射默认图标（Lucide；审核类、仓储类、生产类等） */
const STAGE_KEY_ICONS: Record<string, LucideIcon> = {
  // 生产/工单类
  bom_check: Layers,
  demand_compute: Calculator,
  material_ready: Package,
  work_order_create: FilePlus,
  work_order_exec: PlayCircle,
  product_inbound: Inbox,
  sales_delivery: Send,
  draft: FileText,
  released: Zap,
  in_progress: PlayCircle,
  cancelled: XCircle,
  completed: CheckCircle,
  executed: PlayCircle,
  /** 不用 Loader2：避免已完成链路仍显示旋转动画 */
  running: PlayCircle,
  failed: XCircle,
  // 审核类
  pending_review: Clock,
  rejected: XCircle,
  audited: CheckCircle,
  approved: CheckCircle,
  effective: Zap,
  executing: PlayCircle,
  delivered: Truck,
  pushed: CheckCircle,
  // 仓储/出入库类
  confirmed: CheckCircle,
  pending: Clock,
  inspected: Search,
  picking: Package,
  notified: Bell,
  shipped: Truck,
  received: PackageCheck,
  signed: FileText,
  borrowed: Download,
  pending_outbound: Upload,
  outbound: Send,
  // 采购申请/报价类
  partial: ArrowLeftRight,
  full: CheckCircle,
  sent: Send,
  accepted: CheckCircle,
  converted: ShoppingCart,
  submitted: Send,
  reviewed: CheckCircle,
  send_or_push: Handshake,
  // 财务类
  settled: DollarSign,
  // 异常处理类
  processing: RefreshCw,
  resolved: CheckCircle,
};

function renderStageIcon(step: SubStage, pixelSize: number): React.ReactNode {
  if (step.icon != null) return step.icon;
  const Cmp = STAGE_KEY_ICONS[step.key] ?? File;
  const n = Math.max(14, Math.round(pixelSize));
  return <Cmp size={n} strokeWidth={2} aria-hidden />;
}

function NodeCircle({
  status,
  isException,
  size,
  step,
  showLabelBelow,
  innerFontSize,
  percent,
  wrapWithTooltip = true,
}: {
  status: SubStage['status'];
  isException?: boolean;
  size: number;
  step: SubStage;
  showLabelBelow: boolean;
  innerFontSize: number;
  percent?: number;
  /** 为 false 时由外层统一包 Tooltip（例如标签绝对定位到列外时） */
  wrapWithTooltip?: boolean;
}) {
  const showPercent = percent != null && percent >= 0 && (status === 'active' || status === 'done');
  const iconSize = showPercent ? size * 0.3 : size * 0.42;

  let bg = 'var(--ant-color-fill-quaternary)';
  let border = '1px solid var(--ant-color-border-secondary)';
  let iconColor = 'var(--ant-color-text-quaternary)';
  let ringShadow = 'none';

  if (status === 'done') {
    bg = 'var(--uni-lc-done-solid)';
    border = 'none';
    iconColor = '#fff';
    ringShadow = '0 1px 3px rgba(0, 0, 0, 0.07)';
  } else if (status === 'active') {
    border = 'none';
    iconColor = '#fff';
    if (isException) {
      bg = 'var(--ant-color-error)';
      ringShadow =
        '0 0 0 3px var(--ant-color-error-bg), 0 2px 10px rgba(0, 0, 0, 0.08)';
    } else {
      bg = 'var(--ant-color-primary)';
      ringShadow =
        '0 0 0 3px var(--ant-color-primary-bg), 0 2px 10px rgba(0, 0, 0, 0.08)';
    }
  }

  const nodeClass =
    'uni-lifecycle-stepper__node' +
    (status === 'active'
      ? ` uni-lifecycle-stepper__node--active${isException ? ' uni-lifecycle-stepper__node--exception' : ''}`
      : '') +
    (status === 'done' ? ' uni-lifecycle-stepper__node--done' : '') +
    (status === 'pending' ? ' uni-lifecycle-stepper__node--pending' : '');

  const node = (
    <span
      className={nodeClass}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: bg,
        border,
        flexShrink: 0,
        boxSizing: 'border-box',
        gap: showPercent ? 2 : 0,
        boxShadow: ringShadow,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          color: iconColor,
        }}
      >
        {renderStageIcon(step, iconSize)}
      </span>
      {showPercent && (
        <span
          style={{
            fontSize: innerFontSize,
            lineHeight: 1.1,
            color: iconColor,
            fontWeight: 600,
          }}
        >
          {Math.round(percent)}%
        </span>
      )}
    </span>
  );
  const content = (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: showLabelBelow ? 8 : 4,
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {node}
      {showLabelBelow && (
        <span
          style={{
            ...stepLabelInlineStyle(step, !!isException),
            width: '100%',
            minWidth: 0,
          }}
        >
          {step.label}
        </span>
      )}
    </span>
  );
  const tooltipTitle = percent != null ? `${step.label} ${Math.round(percent)}%` : step.label;
  if (!wrapWithTooltip) return content;
  return <Tooltip title={tooltipTitle}>{content}</Tooltip>;
}

function stepLabelInlineStyle(
  step: SubStage,
  isException: boolean,
  layout: 'ellipsis' | 'wrap' = 'ellipsis',
): React.CSSProperties {
  const { status } = step;
  const labelColor =
    status === 'pending'
      ? 'var(--ant-color-text-tertiary)'
      : status === 'active' && !isException
        ? 'var(--ant-color-primary)'
        : status === 'active' && isException
          ? 'var(--ant-color-error)'
          : status === 'done'
            ? 'var(--uni-lc-done-label)'
            : 'var(--ant-color-text)';
  const labelWeight = status === 'active' ? 600 : status === 'done' ? 500 : 400;
  const base: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.35,
    color: labelColor,
    fontWeight: labelWeight,
    textAlign: 'center',
  };
  if (layout === 'wrap') {
    return {
      ...base,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      overflow: 'visible',
    };
  }
  return {
    ...base,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

function ConnectorTrack({
  completed,
  widthPx,
}: {
  completed: boolean;
  widthPx: number;
}) {
  return (
    <span
      className={
        'uni-lifecycle-stepper__track' +
        (completed ? ' uni-lifecycle-stepper__track--done' : ' uni-lifecycle-stepper__track--todo')
      }
      style={{
        width: widthPx,
      }}
    />
  );
}

export const UniLifecycleStepper: React.FC<UniLifecycleStepperProps> = ({
  steps,
  status,
  nodeSize = NODE_SIZE,
  showLabels = true,
  innerFontSize = INNER_FONT_SIZE,
  nextStepSuggestions,
  hideNextStepSuggestions = false,
  connectorWidth = CONNECTOR_WIDTH_DEFAULT,
  stepLabelMaxWidth = STEP_LABEL_MAX_WIDTH_DEFAULT,
}) => {
  const { t } = useTranslation();
  const isException = status === 'exception';
  if (!steps.length) return null;

  /** 标签列与节点列同宽下限：至少能容纳 stepLabelMaxWidth，避免文案挤在节点宽度内被截断 */
  const stepSlotWidth = Math.max(nodeSize, stepLabelMaxWidth);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        className="uni-lifecycle-stepper"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: showLabels ? 8 : 0,
          width: '100%',
        }}
      >
        {/* 仅圆点 + 连线一行，固定高度与圆直径一致，避免标签占位导致连线垂直跑偏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: 'nowrap',
            gap: 0,
            height: nodeSize,
            minHeight: nodeSize,
          }}
        >
          {steps.map((step, idx) => {
            const tooltipTitle =
              step.percent != null ? `${step.label} ${Math.round(step.percent)}%` : step.label;
            const stepIsException = Boolean(isException && step.status === 'active');
            return (
              <React.Fragment key={step.key}>
                {idx > 0 && (
                  <ConnectorTrack completed={steps[idx - 1]?.status === 'done'} widthPx={connectorWidth} />
                )}
                <Tooltip title={tooltipTitle}>
                  <div
                    style={{
                      width: stepSlotWidth,
                      flexShrink: 0,
                      height: nodeSize,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: nodeSize,
                        height: nodeSize,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <NodeCircle
                        status={step.status}
                        isException={stepIsException}
                        size={nodeSize}
                        step={step}
                        showLabelBelow={false}
                        wrapWithTooltip={false}
                        innerFontSize={innerFontSize}
                        percent={step.percent}
                      />
                    </div>
                  </div>
                </Tooltip>
              </React.Fragment>
            );
          })}
        </div>
        {showLabels && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              flexWrap: 'nowrap',
              gap: 0,
            }}
          >
            {steps.map((step, idx) => {
              const stepIsException = Boolean(isException && step.status === 'active');
              return (
                <React.Fragment key={`${step.key}-lbl`}>
                  {idx > 0 && (
                    <div style={{ width: connectorWidth, flexShrink: 0, height: 1 }} aria-hidden />
                  )}
                  <div
                    style={{
                      width: stepSlotWidth,
                      flexShrink: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      overflow: 'visible',
                      paddingLeft: 4,
                      paddingRight: 4,
                      boxSizing: 'border-box',
                    }}
                  >
                    <span
                      style={{
                        ...stepLabelInlineStyle(step, stepIsException, 'wrap'),
                        maxWidth: '100%',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
      {!hideNextStepSuggestions && nextStepSuggestions && nextStepSuggestions.length > 0 && (
        <div
          className="uni-lifecycle-stepper__next"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--ant-color-text)',
            background: 'var(--ant-color-fill-quaternary)',
            border: '1px solid var(--ant-color-border-secondary)',
          }}
        >
          <span className="uni-lifecycle-stepper__next-icon-wrap" aria-hidden>
            <Lightbulb size={18} strokeWidth={2} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: 'var(--ant-color-text-secondary)' }}>
              {t('components.uniLifecycle.nextStep')}
            </span>
            <span style={{ color: 'var(--ant-color-text-secondary)' }}>：</span>
            <span style={{ color: 'var(--ant-color-text)' }}>
              {nextStepSuggestions.join(t('components.uniLifecycle.nextStepSeparator'))}
            </span>
          </span>
        </div>
      )}
    </div>
  );
};
