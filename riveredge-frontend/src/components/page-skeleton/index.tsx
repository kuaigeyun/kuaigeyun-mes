/**
 * 页面骨架屏（主内容区统一视觉）
 *
 * 后台各路由懒加载时共用同一套占位：顶栏摘要 + 指标卡栅格 + 中下区块，
 * 与工作台/统计类页面结构对齐，减少「一种路由一种骨架」的割裂感。
 *
 * - content：默认，主内容区标准骨架（绝大多数路由 Suspense）
 * - compact：极轻量占位（全屏鉴权等待已改用 PageLoadingLottie）
 */

import React from 'react';
import { Skeleton, theme } from 'antd';
import './index.less';
import type { GlobalToken } from 'antd/es/theme/interface';
import { PAGE_SPACING } from '../layout-templates/constants';

const { useToken } = theme;

export type PageSkeletonVariant = 'content' | 'compact';

/** @deprecated 与 content 相同，保留别名便于渐进替换 */
export type LegacyPageSkeletonVariant = PageSkeletonVariant | 'default' | 'minimal' | 'dashboard';

export interface PageSkeletonProps {
  variant?: LegacyPageSkeletonVariant;
}

function cardShell(token: GlobalToken): React.CSSProperties {
  return {
    padding: 16,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    minWidth: 0,
  };
}

function normalizeVariant(v: PageSkeletonProps['variant']): PageSkeletonVariant {
  if (v === 'compact') return v;
  if (v === 'rolesPermissions') return 'content';
  // default | minimal | dashboard | content | undefined → 统一主内容骨架
  return 'content';
}

/** 主内容区统一骨架（与工作台信息密度大致同级，响应式栅格） */
function UnifiedContentSkeleton({ token }: { token: GlobalToken }) {
  const gap = PAGE_SPACING.BLOCK_GAP;
  const shell = cardShell(token);
  const gridGap = 16;

  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: 0,
        margin: 0,
        minHeight: 'min(58vh, 520px)',
      }}
    >
      {/* 顶距由 .uni-tabs-content 的 margin-top:16px 承担，此处不再加 margin，避免与标签栏下形成双 16 */}
      <div style={{ marginBottom: gap }}>
        <Skeleton.Input active size="small" style={{ width: 640, height: 32, marginBottom: 4 }} />
      </div>

      {/* 指标卡栅格（仅保留一行仿指标卡，避免双行拥挤） */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: gridGap,
          marginBottom: gap,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={shell}>
            <Skeleton active title={{ width: '50%' }} paragraph={{ rows: 2, width: ['100%', '65%'] }} />
          </div>
        ))}
      </div>

      {/* 下区：主列表 + 侧栏 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: gridGap,
        }}
      >
        <div style={shell}>
          <Skeleton active title={{ width: '28%' }} paragraph={{ rows: 6, width: ['100%', '100%', '96%', '92%', '88%', '40%'] }} />
        </div>
        <div style={shell}>
          <Skeleton active title={{ width: '36%' }} paragraph={{ rows: 5, width: ['100%', '90%', '85%', '70%', '55%'] }} />
        </div>
      </div>
    </div>
  );
}

function CompactSkeleton() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        boxSizing: 'border-box',
        padding: PAGE_SPACING.PADDING,
      }}
    >
      <Skeleton active title={false} paragraph={{ rows: 2, width: ['72%', '44%'] }} />
    </div>
  );
}

const PageSkeleton: React.FC<PageSkeletonProps> = ({ variant: rawVariant }) => {
  const { token } = useToken();
  const variant = normalizeVariant(rawVariant);

  if (variant === 'compact') {
    return <CompactSkeleton />;
  }
  return <UnifiedContentSkeleton token={token} />;
};

export default PageSkeleton;
