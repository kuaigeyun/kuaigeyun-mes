/**
 * UniLifecycleStepper - 所有节点展示，小进度圈之间用线连接
 *
 * 用于详情抽屉等需要「全节点+连线」展示的场景；与业务解耦，可复用。
 */

import React, { useMemo } from 'react';
import { Tooltip } from 'antd';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { translateLifecycleResult } from '../../utils/globalLifecycleI18n';
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
  JapaneseYen,
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
  /** 子阶段节点内进度文字字号（保留 API，圆环内不再展示百分比） */
  innerFontSize?: number;
  /** 当前阶段的下一步操作建议，可选 */
  nextStepSuggestions?: string[];
  /** 为 true 时不渲染下一步提示行（可由外层如抽屉区块标题承接） */
  hideNextStepSuggestions?: boolean;
  /** 相邻节点之间连接线固定宽度（水平间距），默认 44 */
  connectorWidth?: number;
  /** 单列文案展示宽度下限（列宽取 max(nodeSize, stepLabelMaxWidth)，防止标签区窄于节点宽度） */
  stepLabelMaxWidth?: number;
  /** 点击某一阶段节点/标签时回调（用于 NPI 阶段门切换等） */
  onStepClick?: (key: string, step: SubStage, index: number) => void;
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
  /** 人民币/日元共用 ¥ 字形；此处用于账款发票阶段，避免美元 $ 歧义 */
  invoicing: JapaneseYen,
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
  wrapWithTooltip = true,
}: {
  status: SubStage['status'];
  isException?: boolean;
  size: number;
  step: SubStage;
  showLabelBelow: boolean;
  /** @deprecated 圆环内不再展示百分比 */
  innerFontSize?: number;
  /** @deprecated 圆环内不再展示百分比 */
  percent?: number;
  /** 为 false 时由外层统一包 Tooltip（例如标签绝对定位到列外时） */
  wrapWithTooltip?: boolean;
}) {
  const iconSize = size * 0.42;
  const useDoneCheck = status === 'done';

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
        gap: 0,
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
        {useDoneCheck ? (
          <CheckCircle size={Math.max(14, Math.round(iconSize))} strokeWidth={2.5} aria-hidden />
        ) : (
          renderStageIcon(step, iconSize)
        )}
      </span>
    </span>
  );

  if (!showLabelBelow) {
    if (!wrapWithTooltip) return node;
    return <Tooltip title={step.label}>{node}</Tooltip>;
  }

  const content = (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {node}
      <span
        style={{
          ...stepLabelInlineStyle(step, !!isException),
          width: '100%',
          minWidth: 0,
        }}
      >
        {step.label}
      </span>
    </span>
  );
  if (!wrapWithTooltip) return content;
  return <Tooltip title={step.label}>{content}</Tooltip>;
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
  onStepClick,
}) => {
  const { t, i18n } = useTranslation();
  const translatedSteps = useMemo(
    () => translateLifecycleResult(t, { percent: 0, stageName: '', mainStages: steps }).mainStages ?? steps,
    [steps, t, i18n.language],
  );
  const isException = status === 'exception';
  if (!translatedSteps.length) return null;

  const n = translatedSteps.length;
  /** 节点外圈（box-shadow）与 hover 放大需额外留白，避免被固定高度裁切 */
  const nodeOuterPadding = 4;
  /** 步骤多时缩短连线，与 flex 均分列宽配合，尽量一屏排开（抽屉等窄容器） */
  const connectorPx = Math.min(
    connectorWidth,
    n >= 9 ? 14 : n >= 8 ? 16 : n >= 7 ? 18 : n >= 6 ? 22 : n >= 5 ? 28 : connectorWidth,
  );
  const labelFontSize = n >= 8 ? 11 : n >= 6 ? 12 : 13;

  const bindStepClick = (step: SubStage, idx: number) =>
    onStepClick
      ? {
          role: 'button' as const,
          tabIndex: 0,
          className: 'uni-lifecycle-stepper__step--clickable',
          onClick: () => onStepClick(step.key, step, idx),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onStepClick(step.key, step, idx);
            }
          },
        }
      : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', minWidth: 0 }}>
      <div
        className="uni-lifecycle-stepper"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: showLabels ? 8 : 0,
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* 圆点行：各阶段 flex 均分宽度，避免固定 180px 列导致超出抽屉 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'stretch',
            width: '100%',
            minWidth: 0,
            minHeight: nodeSize + nodeOuterPadding * 2,
            padding: `${nodeOuterPadding}px 0`,
            overflow: 'visible',
          }}
        >
          {translatedSteps.map((step, idx) => {
            const stepIsException = Boolean(isException && step.status === 'active');
            return (
              <React.Fragment key={step.key}>
                {idx > 0 && (
                  <ConnectorTrack completed={translatedSteps[idx - 1]?.status === 'done'} widthPx={connectorPx} />
                )}
                <Tooltip title={step.label}>
                  <div
                    {...bindStepClick(step, idx)}
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'visible',
                      cursor: onStepClick ? 'pointer' : undefined,
                    }}
                  >
                    <NodeCircle
                      status={step.status}
                      isException={stepIsException}
                      size={nodeSize}
                      step={step}
                      showLabelBelow={false}
                      wrapWithTooltip={false}
                    />
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
              justifyContent: 'stretch',
              width: '100%',
              minWidth: 0,
            }}
          >
            {translatedSteps.map((step, idx) => {
              const stepIsException = Boolean(isException && step.status === 'active');
              return (
                <React.Fragment key={`${step.key}-lbl`}>
                  {idx > 0 && (
                    <div style={{ width: connectorPx, flexShrink: 0, height: 1 }} aria-hidden />
                  )}
                  <div
                    {...bindStepClick(step, idx)}
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      overflow: 'visible',
                      paddingLeft: 2,
                      paddingRight: 2,
                      boxSizing: 'border-box',
                      cursor: onStepClick ? 'pointer' : undefined,
                    }}
                  >
                    <span
                      style={{
                        ...stepLabelInlineStyle(step, stepIsException, 'wrap'),
                        maxWidth: '100%',
                        fontSize: labelFontSize,
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
