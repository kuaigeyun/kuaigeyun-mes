/**
 * 快客户 (Kuaicrm) APP 入口文件 - 占位
 *
 * 以销售漏斗为核心的客户管理，轻客户管理模块。
 * 路由约定：/apps/kuaicrm
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

const KuaicrmApp: React.FC = () => {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <h2>快客户 (Kuaicrm)<PlanningBadge /></h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 16 }}>
        以销售漏斗为核心的客户管理，功能开发中，敬请期待。
      </p>
    </div>
  );
};

export default KuaicrmApp;
