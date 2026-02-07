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

/**
 * 页面骨架屏组件
 *
 * 提供统一的页面加载占位效果。
 * 边距为 0，与 uni-tabs 内容区保持一致（uni-tabs 已提供 0 16px 16px 16px 的 padding）。
 */
const PageSkeleton: React.FC = () => {
  return (
    <div style={{ padding: 0 }}>
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

