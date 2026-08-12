/**
 * 列表「执行状态」唯一展示真源：状态徽章（无进度圆环）。
 * 详情全链路请用 UniLifecycleStepper；禁止在列表再挂 Progress circle。
 */

import React from 'react';
import { Tag, Tooltip } from 'antd';
import type { TagProps } from 'antd';
import { CheckCircle, CircleMinus, PlayCircle } from 'lucide-react';
import {
  RE_STATUS_BADGE_DRAFT,
  resolveStatusTagDisplayProps,
} from '../../constants/statusBadges';
import { getDocumentLifecycleStageTagProps } from '../../utils/documentLifecycleStatusTag';
import type { LifecycleResult, SubStage } from './types';
import './UniLifecycleStepper.less';

/**
 * 按整体进度启发式取色（仅未知阶段名回落）。
 * 已知阶段名须走 `getDocumentLifecycleStageTagProps`，否则「已通过」等中段会被 percent=0 刷成草稿灰。
 */
export function resolveLifecycleBadgeColor(lifecycle: Pick<LifecycleResult, 'status' | 'percent'>): string {
  const status = lifecycle.status;
  if (status === 'success') return 'success';
  if (status === 'exception') return 'error';
  if (status === 'active') return 'processing';
  const percent = Math.min(100, Math.max(0, Math.round(lifecycle.percent ?? 0)));
  if (percent >= 100) return 'success';
  if (percent <= 0) return RE_STATUS_BADGE_DRAFT;
  return 'processing';
}

/** 列表执行状态徽章配色：阶段名语义优先，未知名再回落 status/percent */
export function resolveLifecycleStageBadgeTagProps(
  stageName: string,
  lifecycle?: Pick<LifecycleResult, 'status' | 'percent'>,
): Pick<TagProps, 'color' | 'style' | 'className' | 'variant'> {
  const stageProps = getDocumentLifecycleStageTagProps(stageName);
  // 登记阶段带 color 或草稿 className；未登记仅有中性 style
  if (stageProps.color || stageProps.className) {
    return stageProps;
  }
  return resolveStatusTagDisplayProps({
    text: stageName,
    color: resolveLifecycleBadgeColor({
      status: lifecycle?.status,
      percent: lifecycle?.percent ?? 0,
    }),
  });
}

function SubStageIcon({ status }: { status: SubStage['status'] }) {
  const iconProps = { size: 14, strokeWidth: 2 } as const;
  if (status === 'done')
    return <CheckCircle {...iconProps} color="var(--uni-lc-done-solid)" aria-hidden />;
  if (status === 'active')
    return <PlayCircle {...iconProps} color="var(--ant-color-primary)" aria-hidden />;
  return <CircleMinus {...iconProps} color="var(--ant-color-text-tertiary)" aria-hidden />;
}

function SubStagesTooltip({
  stageName,
  subStages,
  subLabel,
  subPercent,
}: {
  stageName: string;
  subStages?: SubStage[];
  subLabel?: string;
  subPercent?: number;
}) {
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
        {stageName} - {subLabel} {Math.round(subPercent)}%
      </span>
    );
  }
  return <span>{stageName}</span>;
}

export interface LifecycleStageBadgeProps {
  stageName: string;
  status?: LifecycleResult['status'];
  percent?: number;
  /** hover 展示子阶段时传入 */
  subStages?: SubStage[];
  subLabel?: string;
  subPercent?: number;
  showTooltip?: boolean;
}

/** 列表「执行状态」徽章（唯一控制源） */
export function LifecycleStageBadge({
  stageName,
  status,
  percent = 0,
  subStages,
  subLabel,
  subPercent,
  showTooltip = false,
}: LifecycleStageBadgeProps) {
  if (!stageName || stageName === '-') {
    return <span>—</span>;
  }

  const badge = (
    <Tag {...resolveLifecycleStageBadgeTagProps(stageName, { status, percent })}>{stageName}</Tag>
  );

  const tipEligible =
    showTooltip &&
    ((subStages && subStages.length > 0) || (subLabel != null && subPercent != null));

  return (
    <span
      className="uni-lifecycle uni-lifecycle--badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        lineHeight: 1,
      }}
    >
      {tipEligible ? (
        <Tooltip
          title={
            <SubStagesTooltip
              stageName={stageName}
              subStages={subStages}
              subLabel={subLabel}
              subPercent={subPercent}
            />
          }
        >
          {badge}
        </Tooltip>
      ) : (
        badge
      )}
    </span>
  );
}
