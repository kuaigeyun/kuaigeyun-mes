/**
 * UniLifecycle - 通用生命周期进度圈
 *
 * 与业务解耦，供销售订单、采购订单、工单等复用。
 * 展示主生命周期进度 + 可选的子生命周期（subPercent/subLabel 或 subStages 全链路）。
 */

import React, { useMemo } from 'react';
import { Progress, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { CheckCircle, CircleMinus, PlayCircle } from 'lucide-react';
import { translateLifecycleResult } from '../../utils/globalLifecycleI18n';
import './UniLifecycleStepper.less';
import type { LifecycleResult, SubStage } from './types';

export interface UniLifecycleProps extends LifecycleResult {
  /** 是否在圈旁显示阶段名，默认 false */
  showLabel?: boolean;
  /** 进度圈尺寸，默认 32 */
  size?: number | 'small';
  /** 是否在详情中展开显示全链路子阶段（Steps 列表），默认 false */
  expandSubStages?: boolean;
  /** 为 false 时圆环 hover 不展示 Tooltip（如列表列已有阶段文案） */
  showCircleTooltip?: boolean;
  /** 为 true 时在圆环内显示百分比（默认关闭；列表/详情仅完成态显示打勾） */
  showPercent?: boolean;
}

const CIRCLE_SIZE = 22;

function SubStageIcon({ status }: { status: SubStage['status'] }) {
  const iconProps = { size: 14, strokeWidth: 2 } as const;
  if (status === 'done')
    return <CheckCircle {...iconProps} color="var(--uni-lc-done-solid)" aria-hidden />;
  if (status === 'active')
    return <PlayCircle {...iconProps} color="var(--ant-color-primary)" aria-hidden />;
  return <CircleMinus {...iconProps} color="var(--ant-color-text-tertiary)" aria-hidden />;
}

function TooltipContent(props: {
  stageName: string;
  subLabel?: string;
  subPercent?: number;
  subStages?: SubStage[];
  statusClass?: string;
  flowClass?: string;
}) {
  const { stageName, subLabel, subPercent, subStages, statusClass, flowClass } = props;
  const meta = (statusClass || flowClass) ? (
    <div style={{ marginTop: 6, opacity: 0.85, fontSize: 12 }}>
      <div>状态类: {statusClass || '-'}</div>
      <div>流转类: {flowClass || '-'}</div>
    </div>
  ) : null;
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
        {meta}
      </div>
    );
  }
  if (subLabel != null && subPercent != null) {
    return (
      <div>
        <span>
          {stageName} · {subLabel} {Math.round(subPercent)}%
        </span>
        {meta}
      </div>
    );
  }
  return (
    <div>
      <span>{stageName}</span>
      {meta}
    </div>
  );
}

export const UniLifecycle: React.FC<UniLifecycleProps> = ({
  percent,
  stageName,
  status: progressStatus,
  subPercent,
  subLabel,
  subStages,
  statusClass,
  flowClass,
  showLabel = false,
  size = CIRCLE_SIZE,
  expandSubStages = false,
  showCircleTooltip = true,
  showPercent = false,
}) => {
  const { t, i18n } = useTranslation();
  const translated = useMemo(
    () =>
      translateLifecycleResult(t, {
        percent,
        stageName,
        status: progressStatus,
        subPercent,
        subLabel,
        subStages,
        statusClass,
        flowClass,
        mainStages: undefined,
      }),
    [t, i18n.language, percent, stageName, progressStatus, subPercent, subLabel, subStages, statusClass, flowClass],
  );
  const displayStageName = translated.stageName;
  const displaySubLabel = translated.subLabel;
  const displaySubStages = translated.subStages;

  const sizeNum = size === 'small' ? CIRCLE_SIZE : typeof size === 'number' ? size : CIRCLE_SIZE;

  const tip = (
    <TooltipContent
      stageName={displayStageName}
      subLabel={displaySubLabel}
      subPercent={subPercent}
      subStages={displaySubStages}
      statusClass={translated.statusClass}
      flowClass={translated.flowClass}
    />
  );

  const circle = (
    <Progress
      type="circle"
      percent={Math.min(100, Math.max(0, Math.round(percent)))}
      size={sizeNum}
      status={progressStatus}
      strokeLinecap="round"
      strokeColor={
        progressStatus === 'exception'
          ? 'var(--ant-color-error)'
          : progressStatus === 'success'
            ? 'var(--uni-lc-done-solid)'
            : undefined
      }
      railColor="var(--ant-color-fill-secondary)"
      format={
        showPercent
          ? undefined
          : progressStatus === 'success'
            ? undefined
            : () => null
      }
    />
  );

  const circleEl = showCircleTooltip ? <Tooltip title={tip}>{circle}</Tooltip> : circle;

  return (
    <span
      className="uni-lifecycle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        verticalAlign: 'middle',
        lineHeight: 1,
      }}
    >
      {circleEl}
      {showLabel && <span style={{ whiteSpace: 'nowrap' }}>{displayStageName}</span>}
      {expandSubStages && displaySubStages && displaySubStages.length > 0 && (
        <div style={{ marginTop: 8, marginLeft: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 16px', alignItems: 'center' }}>
            {displaySubStages.map((s) => (
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
