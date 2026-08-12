/**
 * UniLifecycle — 列表阶段展示入口（委托 LifecycleStageBadge）。
 *
 * 唯一控制源：LifecycleStageBadge（徽章，无进度圆环）。
 * 详情全链路：UniLifecycleStepper。
 * 禁止在列表再挂 Progress type="circle"。
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { translateLifecycleResult } from '../../utils/globalLifecycleI18n';
import { LifecycleStageBadge } from './LifecycleStageBadge';
import type { LifecycleResult } from './types';

export interface UniLifecycleProps extends LifecycleResult {
  /**
   * @deprecated 列表一律徽章；保留参数避免调用方报错，忽略圆环相关行为。
   */
  showLabel?: boolean;
  /** @deprecated 圆环已移除 */
  size?: number | 'small';
  /** @deprecated 子阶段展开请用 UniLifecycleStepper */
  expandSubStages?: boolean;
  /** 为 true 时徽章 hover 展示子阶段 */
  showCircleTooltip?: boolean;
  /** @deprecated 圆环已移除 */
  showPercent?: boolean;
}

/**
 * @deprecated 请优先使用 ListUniLifecycleCell / LifecycleStageBadge。
 * 保留别名仅为兼容仍直接 import UniLifecycle 的列表页。
 */
export const UniLifecycle: React.FC<UniLifecycleProps> = ({
  percent,
  stageName,
  status,
  subPercent,
  subLabel,
  subStages,
  statusClass,
  flowClass,
  showCircleTooltip = false,
}) => {
  const { t, i18n } = useTranslation();
  const translated = useMemo(
    () =>
      translateLifecycleResult(t, {
        percent,
        stageName,
        status,
        subPercent,
        subLabel,
        subStages,
        statusClass,
        flowClass,
        mainStages: undefined,
      }),
    [t, i18n.language, percent, stageName, status, subPercent, subLabel, subStages, statusClass, flowClass],
  );

  return (
    <LifecycleStageBadge
      stageName={translated.stageName}
      status={translated.status}
      percent={translated.percent}
      subStages={translated.subStages}
      subLabel={translated.subLabel}
      subPercent={translated.subPercent}
      showTooltip={showCircleTooltip}
    />
  );
};

export {
  LifecycleStageBadge,
  resolveLifecycleBadgeColor,
  resolveLifecycleStageBadgeTagProps,
} from './LifecycleStageBadge';
export { UniLifecycleStepper } from './UniLifecycleStepper';
export type { LifecycleResult, SubStage, SubStageStatus } from './types';
