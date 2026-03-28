/**
 * 页面骨架屏组件
 *
 * 用于页面加载时的占位显示，提供更好的用户体验
 *
 * Author: Luigi Lu
 * Date: 2025-12-27
 */

import React from 'react';
import { Skeleton, Spin } from 'antd';
import { PAGE_SPACING } from '../layout-templates/constants';

export interface PageSkeletonProps {
  /**
   * - default：完整表格骨架（较慢网络）
   * - minimal：轻量居中 Spin，路由懒加载时优先即显、减少主线程与布局计算
   * - dashboard / rolesPermissions：与对应模板边距一致
   */
  variant?: 'default' | 'minimal' | 'dashboard' | 'rolesPermissions';
}

const P = PAGE_SPACING.PADDING;

/**
 * 页面骨架屏组件
 *
 * 提供统一的页面加载占位效果。
 * - default: 无内边距，适用于多数列表/表单页
 * - dashboard: 边距 0 16px 16px 16px，仅工作台/分析页使用，与 DashboardTemplate 一致
 * - rolesPermissions: 边距与角色权限页一致（0 16px 16px 16px），左右分栏布局
 */
const PageSkeleton: React.FC<PageSkeletonProps> = ({ variant = 'default' }) => {
  const padding =
    variant === 'dashboard' || variant === 'rolesPermissions'
      ? `0 ${P}px ${P}px ${P}px`
      : 0;

  if (variant === 'minimal') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          padding: `${P}px`,
          boxSizing: 'border-box',
        }}
        aria-busy="true"
        aria-label="Loading"
      >
        <Spin />
      </div>
    );
  }

  if (variant === 'rolesPermissions') {
    return (
      <div style={{ padding, display: 'flex', height: '100%', gap: 0, boxSizing: 'border-box' }}>
        {/* 左侧栏骨架（与角色树宽度一致） */}
        <div style={{ width: 300, flexShrink: 0, padding: 8 }}>
          <Skeleton.Input active size="small" style={{ width: '100%', marginBottom: 8 }} />
          <Skeleton.Button active block style={{ marginBottom: 8 }} />
          <Skeleton active paragraph={{ rows: 6, width: ['100%', '100%', '80%', '80%', '60%', '60%'] }} />
        </div>
        {/* 右侧主区骨架 */}
        <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <Skeleton.Input active size="default" style={{ width: 120, marginRight: 8 }} />
            <Skeleton.Input active size="default" style={{ width: 200 }} />
          </div>
          <Skeleton
            active
            paragraph={{
              rows: 10,
              width: ['100%', '100%', '100%', '100%', '100%', '100%', '100%', '100%', '90%', '70%'],
            }}
            title={{ width: '60%' }}
          />
        </div>
      </div>
    );
  }

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

