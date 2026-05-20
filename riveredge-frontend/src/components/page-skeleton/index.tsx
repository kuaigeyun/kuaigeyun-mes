/**
 * 路由懒加载 / 权限等待：主内容区居中 antd Spin（与 SystemDashboardRouteGate 等一致）
 *
 * 全屏鉴权等待仍使用 PageLoadingLottie，不在此组件内处理。
 */

import React from 'react';
import { Spin } from 'antd';
import type { SpinProps } from 'antd';

/** @deprecated variant 已废弃，保留类型以兼容旧调用 */
export type PageSkeletonVariant = 'content' | 'compact';

/** @deprecated 与 PageSkeletonVariant 相同，保留别名便于渐进替换 */
export type LegacyPageSkeletonVariant = PageSkeletonVariant | 'default' | 'minimal' | 'dashboard';

export interface PageSkeletonProps {
  /** @deprecated 已统一为 Spin，忽略即可 */
  variant?: LegacyPageSkeletonVariant;
  /** Spin 尺寸 */
  size?: SpinProps['size'];
  /** 占位区域最小高度 */
  minHeight?: number | string;
}

const PageSkeleton: React.FC<PageSkeletonProps> = ({
  minHeight = 'min(58vh, 520px)',
  size = 'large',
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      minHeight,
      padding: 48,
      boxSizing: 'border-box',
    }}
  >
    <Spin size={size} />
  </div>
);

export default PageSkeleton;
