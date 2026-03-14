/**
 * 快协同 (Kuaichain) APP 入口文件 - 占位
 *
 * 内外部供应链协同网络，轻供应链模块。
 * 路由约定：/apps/kuaichain
 */

import React from 'react';

const PlanningBadge = () => (
  <span
    style={{
      display: 'inline-block',
      marginLeft: 8,
      padding: '2px 8px',
      fontSize: 12,
      color: '#1890ff',
      background: '#e6f7ff',
      borderRadius: 4,
      fontWeight: 'normal',
    }}
  >
    规划中
  </span>
);

const KuaichainApp: React.FC = () => {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <h2>快协同 (Kuaichain)<PlanningBadge /></h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 16 }}>
        内外部供应链协同网络，功能开发中，敬请期待。
      </p>
    </div>
  );
};

export default KuaichainApp;
