/**
 * 页面骨架屏组件
 *
 * 用于页面加载时的占位显示，提供更好的用户体验
 *
 * Author: Luigi Lu
 * Date: 2025-12-27
 */

import React from 'react';
import { Skeleton } from 'antd';
import { PAGE_SPACING } from '../layout-templates/constants';

export interface PageSkeletonProps {
  /** 工作台/分析页等使用 DashboardTemplate 的页面需传入 'dashboard'，与模板边距一致 */
  variant?: 'default' | 'dashboard';
}

/**
 * 页面骨架屏组件
 *
 * 提供统一的页面加载占位效果。
 * - default: 无内边距，适用于多数列表/表单页
 * - dashboard: 边距 0 16px 16px 16px，仅工作台/分析页使用，与 DashboardTemplate 一致
 */
const PageSkeleton: React.FC<PageSkeletonProps> = ({ variant = 'default' }) => {
  const padding = variant === 'dashboard'
    ? `0 ${PAGE_SPACING.PADDING}px ${PAGE_SPACING.PADDING}px ${PAGE_SPACING.PADDING}px`
    : 0;
  return (
    <div style={{ padding }}>
      {/* 页面标题骨架 */}
      <Skeleton.Input
        active
        size="large"
        style={{ width: 200, height: 32, marginBottom: 24 }}
      />
      
      {/* 操作栏骨架 */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton.Button active size="default" style={{ marginRight: 8 }} />
        <Skeleton.Button active size="default" style={{ marginRight: 8 }} />
        <Skeleton.Input active size="default" style={{ width: 200, display: 'inline-block' }} />
      </div>
      
      {/* 表格骨架 */}
      <Skeleton
        active
        paragraph={{
          rows: 8,
          width: ['100%', '100%', '100%', '100%', '100%', '100%', '100%', '100%'],
        }}
        title={{ width: '100%' }}
      />
    </div>
  );
};

export default PageSkeleton;

