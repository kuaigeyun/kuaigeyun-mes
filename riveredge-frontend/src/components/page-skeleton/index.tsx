/**
 * 页面骨架屏组件
 *
 * 用于页面加载时的占位显示，提供简约、专业的工业化美感。
 * 针对不同页面模板提供对应的骨架形态，减少首屏加载时的视觉突变。
 *
 * Author: Luigi Lu
 * Date: 2025-12-27
 * Modified: 2024-04-25
 */

import React from 'react';
import { Skeleton, theme } from 'antd';
import { PAGE_SPACING } from '../layout-templates/constants';

const { useToken } = theme;

export interface PageSkeletonProps {
  /**
   * - default：极简基础骨架（标题 + 少量正文行）
   * - minimal：最简洁骨架（仅三行占位），用于局部加载或路由闪过
   * - dashboard：对齐工作台页面的边距与结构
   * - rolesPermissions：对齐角色权限页的左右分栏结构
   */
  variant?: 'default' | 'minimal' | 'dashboard' | 'rolesPermissions';
}

/**
 * 页面骨架屏组件
 */
const PageSkeleton: React.FC<PageSkeletonProps> = ({ variant = 'default' }) => {
  const { token } = useToken();
  const P = PAGE_SPACING.PADDING;
  
  const padding =
    variant === 'dashboard' || variant === 'rolesPermissions'
      ? `${P}px`
      : `${P}px`;

  // 极简变体：用于路由极速切换或局部加载
  if (variant === 'minimal') {
    return (
      <div style={{ padding, width: '100%', maxWidth: 600 }}>
        <Skeleton
          active
          title={false}
          paragraph={{ rows: 2, width: ['70%', '40%'] }}
        />
      </div>
    );
  }

  // 角色权限页专用：保持左右分栏结构一致，防止页面抖动
  if (variant === 'rolesPermissions') {
    return (
      <div style={{ padding, display: 'flex', height: '100%', gap: 16, boxSizing: 'border-box' }}>
        {/* 左侧栏骨架 */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <Skeleton.Input active size="small" style={{ width: '100%', height: 24, marginBottom: 12 }} />
          <Skeleton active paragraph={{ rows: 6, width: '100%' }} title={false} />
        </div>
        {/* 右侧主区骨架 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton.Input active size="small" style={{ width: 120, height: 24, marginBottom: 20 }} />
          <Skeleton
            active
            title={{ width: '40%', style: { marginBottom: 24 } }}
            paragraph={{ rows: 5, width: ['100%', '100%', '95%', '90%', '60%'] }}
          />
        </div>
      </div>
    );
  }

  // 工作台专用：顶部大标题 + 栅格卡片感
  if (variant === 'dashboard') {
    return (
      <div style={{ padding }}>
        <Skeleton.Input active size="small" style={{ width: 140, height: 24, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ padding: 16, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadius }}>
              <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 默认：工业极简风（标题 + 四行正文）
  return (
    <div style={{ padding, width: '100%' }}>
      <div style={{ marginBottom: 32 }}>
        <Skeleton.Input
          active
          size="small"
          style={{ width: 160, height: 24 }}
        />
      </div>
      
      <Skeleton
        active
        paragraph={{
          rows: 4,
          width: ['100%', '95%', '90%', '40%'],
          style: { marginTop: 0 }
        }}
        title={{ width: '60%', style: { marginBottom: 20 } }}
      />
    </div>
  );
};

export default PageSkeleton;

